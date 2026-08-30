package com.gl.app.NotificationService.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gl.app.NotificationService.client.GeminiClient;
import com.gl.app.NotificationService.entity.LeaderboardSnapshot;
import com.gl.app.NotificationService.entity.Notification;
import com.gl.app.NotificationService.entity.NotificationDelivery;
import com.gl.app.NotificationService.repository.LeaderboardSnapshotRepository;
import com.gl.app.NotificationService.repository.NotificationDeliveryRepository;
import com.gl.app.NotificationService.repository.NotificationRepository;
import com.gl.app.NotificationService.service.RankRecalculationService;
import com.gl.app.NotificationService.service.RuleBasedFallbackEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/**
 * Notification Composition Worker.
 *
 * Claims PENDING_COMPOSITION rows via SKIP LOCKED, then:
 * 1. Evaluates Full Suppression (single SQL query — if all habits complete, suppress and exit).
 * 2. Builds per-source signal data (personal + incomplete groups only).
 * 3. Applies Own-Stat Patch to the leaderboard snapshot using live coin data.
 * 4. Calls Gemini for structured JSON output.
 * 5. Falls back to RuleBasedFallbackEngine on ANY Gemini failure (timeout, rate-limit, bad JSON).
 * 6. Saves NotificationDelivery + marks Notification COMPOSED in a single atomic transaction.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationCompositionWorker {

    private final NotificationRepository notificationRepository;
    private final NotificationDeliveryRepository deliveryRepository;
    private final LeaderboardSnapshotRepository leaderboardSnapshotRepository;
    private final RankRecalculationService rankRecalculationService;
    private final GeminiClient geminiClient;
    private final RuleBasedFallbackEngine fallbackEngine;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${habit.service.url:http://localhost:8082}")
    private String habitServiceUrl;

    @Value("${gemini.unsubscribe.secret:default-dev-secret-key-123456}")
    private String unsubscribeSecret;

    @Value("${auth.service.url:http://localhost:8080}")
    private String authServiceUrl;

    @Value("${group.service.url:http://localhost:8083}")
    private String groupServiceUrl;

    @Value("${app.base-url:http://localhost:8081}")
    private String baseUrl;

    @Scheduled(fixedDelayString = "${composition.worker.delay:5000}")
    public void processPendingCompositions() {
        List<Notification> batch = claimBatch();
        if (batch.isEmpty()) return;

        for (Notification notification : batch) {
            try {
                processSingle(notification);
            } catch (Exception e) {
                log.error("Failed to compose notification {}", notification.getId(), e);
                markAsFailed(notification);
            }
        }
    }

    @Transactional
    public List<Notification> claimBatch() {
        List<Notification> pending = notificationRepository.findPendingForComposition(10);
        for (Notification n : pending) {
            n.setStatus("PROCESSING");
        }
        return notificationRepository.saveAll(pending);
    }

    private void processSingle(Notification notification) {
        String userId = notification.getUserId();
        log.info("Composing notification {} for user {}", notification.getId(), userId);

        // --- Step 0: Fetch user metadata (timezone for deadline calculation, emailVerified, emailBounced) ---
        Map<String, Object> userMeta = fetchUserMeta(userId);
        if (userMeta == null) {
            log.error("Could not fetch user metadata for userId {}, marking FAILED", userId);
            markAsFailed(notification);
            return;
        }

        Boolean emailVerified = (Boolean) userMeta.getOrDefault("emailVerified", false);
        Boolean emailBounced = (Boolean) userMeta.getOrDefault("emailBounced", false);

        if (!Boolean.TRUE.equals(emailVerified)) {
            log.info("Email not verified for userId {}, suppressing", userId);
            updateStatus(notification, "SUPPRESSED");
            return;
        }
        if (Boolean.TRUE.equals(emailBounced)) {
            log.info("Email bounced for userId {}, suppressing permanently", userId);
            updateStatus(notification, "SUPPRESSED");
            return;
        }

        String ianaTimezone = (String) userMeta.getOrDefault("timezone", "UTC");
        String userEmail = (String) userMeta.get("email");
        String username = (String) userMeta.getOrDefault("username", "Habitioneer");

        // --- Step 1: Full Suppression Check ---
        // Fetch per-source completion status from HabitService (one call)
        List<Map<String, Object>> sourceStatus = fetchSourceCompletionStatus(userId);
        if (sourceStatus == null) {
            log.error("Could not fetch completion status for userId {}, marking FAILED", userId);
            markAsFailed(notification);
            return;
        }
        if (sourceStatus.isEmpty()) {
            log.info("No habits found for userId {}, suppressing", userId);
            updateStatus(notification, "SUPPRESSED");
            return;
        }

        // Check if everything is complete
        boolean allComplete = sourceStatus.stream().allMatch(s -> {
            int total = (int) s.getOrDefault("totalHabits", 0);
            int done = (int) s.getOrDefault("completedHabits", 0);
            return total > 0 && total == done;
        });

        if (allComplete) {
            log.info("Full suppression for userId {} — all habits complete", userId);
            updateStatus(notification, "SUPPRESSED");
            return;
        }

        // --- Step 2: Per-Source Filtering ---
        // Personal habits (groupId == null)
        Map<String, Object> personalSource = sourceStatus.stream()
                .filter(s -> s.get("groupId") == null)
                .findFirst().orElse(null);

        boolean personalIncomplete = personalSource != null
                && (int) personalSource.getOrDefault("completedHabits", 0)
                < (int) personalSource.getOrDefault("totalHabits", 0);

        // Incomplete groups (groupId != null, notificationsEnabled == true)
        List<Map<String, Object>> incompleteGroups = sourceStatus.stream()
                .filter(s -> s.get("groupId") != null)
                .filter(s -> Boolean.TRUE.equals(s.get("groupNotificationsEnabled")))
                .filter(s -> (int) s.getOrDefault("completedHabits", 0)
                        < (int) s.getOrDefault("totalHabits", 0))
                .collect(Collectors.toList());

        // --- Step 3: Build Gemini Payload ---
        ZonedDateTime userNow = ZonedDateTime.now(ZoneId.of(ianaTimezone));
        ZonedDateTime userDeadline = userNow.toLocalDate().atTime(12, 0).atZone(ZoneId.of(ianaTimezone));
        if (userNow.isAfter(userDeadline)) {
            userDeadline = userDeadline.plusDays(1);
        }
        long hoursUntilDeadline = ChronoUnit.HOURS.between(userNow, userDeadline);
        String localTimeOfDay = userNow.format(DateTimeFormatter.ofPattern("h:mm a"));

        // Fetch personal consistency stats
        GeminiClient.RetentionPromptPayload promptPayload = new GeminiClient.RetentionPromptPayload();
        promptPayload.username = username;

        if (personalIncomplete) {
            Map<String, Object> consistencyStats = fetchPersonalConsistencyStats(userId);
            GeminiClient.RetentionPromptPayload.PersonalSignals ps = new GeminiClient.RetentionPromptPayload.PersonalSignals();
            ps.incompleteCount = (int) personalSource.getOrDefault("totalHabits", 0)
                    - (int) personalSource.getOrDefault("completedHabits", 0);
            ps.weeklyConsistency = (double) consistencyStats.getOrDefault("weeklyConsistency", 0.0);
            ps.monthlyConsistency = (double) consistencyStats.getOrDefault("monthlyConsistency", 0.0);
            ps.yearlyConsistency = (double) consistencyStats.getOrDefault("yearlyConsistency", 0.0);
            ps.hoursUntilMidnight = hoursUntilDeadline;
            ps.localTimeOfDay = localTimeOfDay;
            ps.currentStreak = (int) personalSource.getOrDefault("currentStreak", 0);
            if (personalSource.get("incompleteHabitNames") != null) {
                List<String> names = (List<String>) personalSource.get("incompleteHabitNames");
                ps.habitNames = names.stream().map(n -> n.replace(".", ".&#8203;")).collect(Collectors.toList());
            }
            promptPayload.personalSignals = ps;
        }

        for (Map<String, Object> group : incompleteGroups) {
            String groupId = String.valueOf(group.get("groupId"));
            String groupName = (String) group.getOrDefault("groupName", "Your Group");

            // Own-Stat Patch: fetch live score and patch it into the Cold snapshot
            int liveScore = fetchLiveGroupScore(userId, groupId);
            List<LeaderboardSnapshot> snapshot = leaderboardSnapshotRepository.findByGroupId(groupId);
            List<LeaderboardSnapshot> patched = rankRecalculationService.patchAndRecalculate(snapshot, userId, liveScore);

            // Find patched rank for this user
            LeaderboardSnapshot myEntry = patched.stream()
                    .filter(e -> e.getUserId().equals(userId))
                    .findFirst().orElse(null);

            int rankTrajectory = 0;
            if (myEntry != null && myEntry.getPreviousRank() != null) {
                rankTrajectory = myEntry.getPreviousRank() - myEntry.getRank();
            }

            GeminiClient.RetentionPromptPayload.GroupSignal gs = new GeminiClient.RetentionPromptPayload.GroupSignal();
            gs.groupId = groupId;
            gs.groupName = groupName;
            gs.incompleteCount = (int) group.getOrDefault("totalHabits", 0)
                    - (int) group.getOrDefault("completedHabits", 0);
            gs.rankTrajectory = rankTrajectory;
            gs.currentRank = myEntry != null && myEntry.getRank() != null ? myEntry.getRank() : 0;
            gs.hoursUntilMidnight = hoursUntilDeadline;
            gs.localTimeOfDay = localTimeOfDay;
            gs.currentStreak = (int) group.getOrDefault("currentStreak", 0);
            if (group.get("incompleteHabitNames") != null) {
                List<String> names = (List<String>) group.get("incompleteHabitNames");
                gs.habitNames = names.stream().map(n -> n.replace(".", ".&#8203;")).collect(Collectors.toList());
            }
            promptPayload.groupSignals.add(gs);
        }

        // --- Step 4: Call Gemini or fall back immediately ---
        String emailBody;
        String emailSubject;
        try {
            GeminiClient.RetentionInsightResponse insight = geminiClient.generateRetentionInsight(promptPayload);
            emailSubject = insight.subject != null && !insight.subject.isBlank() 
                            ? insight.subject 
                            : "Your habits are waiting for you 🌟";
            emailBody = stitchEmailBody(insight, promptPayload);
        } catch (Exception e) {
            log.warn("Gemini failed for userId {}: {}. Using rule-based fallback.", userId, e.getMessage());
            emailSubject = "Your habits are waiting for you 🌟";
            emailBody = buildFallbackEmailBody(promptPayload, userId);
        }

        String unsubscribeLink = String.format("http://localhost:8084/notifications/unsubscribe?userId=%s&token=%s", userId, generateUnsubscribeToken(userId));
        emailBody = wrapInHtml(emailBody, unsubscribeLink, hoursUntilDeadline);

        // --- Step 5: Save delivery atomically ---
        String payload = buildEmailPayload(userEmail, emailSubject, emailBody, userId);
        saveDeliveryAndComplete(notification, payload);
    }

    private String stitchEmailBody(GeminiClient.RetentionInsightResponse insight,
                                    GeminiClient.RetentionPromptPayload payload) {
        StringBuilder sb = new StringBuilder();

        if (insight.personalPush != null && !insight.personalPush.isBlank()) {
            sb.append(insight.personalPush).append("\n\n");
        }

        for (GeminiClient.RetentionPromptPayload.GroupSignal gs : payload.groupSignals) {
            String groupMsg = insight.groupPushes.get(gs.groupId);
            if (groupMsg != null && !groupMsg.isBlank()) {
                sb.append(groupMsg).append("\n\n");
            }
        }

        return sb.toString();
    }

    private String buildFallbackEmailBody(GeminiClient.RetentionPromptPayload payload, String userId) {
        String username = payload.username;
        Map<String, Object> personalSignals = null;
        if (payload.personalSignals != null) {
            personalSignals = new HashMap<>();
            personalSignals.put("incompletePersonalCount", payload.personalSignals.incompleteCount);
            personalSignals.put("weeklyConsistency", payload.personalSignals.weeklyConsistency);
            personalSignals.put("monthlyConsistency", payload.personalSignals.monthlyConsistency);
            personalSignals.put("yearlyConsistency", payload.personalSignals.yearlyConsistency);
            personalSignals.put("hoursUntilMidnight", payload.personalSignals.hoursUntilMidnight);
            personalSignals.put("localTimeOfDay", payload.personalSignals.localTimeOfDay);
            personalSignals.put("currentStreak", payload.personalSignals.currentStreak);
            personalSignals.put("habitNames", payload.personalSignals.habitNames);
        }

        List<Map<String, Object>> groupSignals = payload.groupSignals.stream()
                .map(gs -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("groupName", gs.groupName);
                    m.put("incompleteCount", gs.incompleteCount);
                    m.put("rankTrajectory", gs.rankTrajectory);
                    m.put("currentRank", gs.currentRank);
                    m.put("hoursUntilMidnight", gs.hoursUntilMidnight);
                    m.put("localTimeOfDay", gs.localTimeOfDay);
                    m.put("currentStreak", gs.currentStreak);
                    m.put("habitNames", gs.habitNames);
                    return m;
                })
                .collect(Collectors.toList());

        return fallbackEngine.buildEmailBody(username, personalSignals, groupSignals, userId, "unused");
    }

    private String wrapInHtml(String contentHtml, String unsubscribeLink, long hoursLeft) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a1a1a; background-image: linear-gradient(#1a1a1a, #1a1a1a); font-family: 'Inter', Helvetica, Arial, sans-serif; color: #ffffff;">
            <table width="100%%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; background-image: linear-gradient(#1a1a1a, #1a1a1a); padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #2C2C2A; background-image: linear-gradient(#2C2C2A, #2C2C2A); border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
                            <tr>
                                <td align="center" style="padding: 40px 20px 20px;">
                                    <table cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                                        <tr>
                                            <td style="vertical-align: middle;">
                                                <img src="cid:habition-logo" alt="Habition Logo" height="40" style="display: block;" />
                                            </td>
                                            <td style="vertical-align: middle; padding-left: 5px;">
                                                <span style="color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px; line-height: 40px; display: inline-block;">Habition</span>
                                            </td>
                                        </tr>
                                    </table>
                                    <h1 style="color: #D0FD3E; margin: 0 0 20px; font-size: 24px; font-weight: 700;">⏰ %d hours left today</h1>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 0 40px 10px; font-size: 16px; line-height: 1.6; color: #e2e8f0;">
                                    %s
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 0 40px 20px;">
                                    <p style="margin: 0; font-size: 15px; color: #a0aec0; text-align: center;">
                                        Complete your remaining habits in the next %d hours to maintain your streak and position on the leaderboard! ⚡
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 0 40px 40px;">
                                    <a href="http://localhost:5173/dashboard" style="display: inline-block; background-color: #D0FD3E; background-image: linear-gradient(#D0FD3E, #D0FD3E); color: #1a1a1a; font-weight: 700; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Complete Habits Now</a>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 14px 0 22px 0; background-color: #222220; background-image: linear-gradient(#222220, #222220); text-align: center; vertical-align: middle;">
                                    <a href="%s" style="color: #666666; font-size: 12px; line-height: 1; text-decoration: underline; margin: 0; display: inline-block;">Unsubscribe from these emails</a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """.formatted(hoursLeft, contentHtml.replace("\n", "<br>"), hoursLeft, unsubscribeLink);
    }

    private String buildEmailPayload(String toEmail, String subject, String body, String userId) {
        try {
            Map<String, String> payload = new HashMap<>();
            payload.put("to", toEmail);
            payload.put("subject", subject);
            payload.put("body", body);
            payload.put("userId", userId);
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return "{\"error\":\"payload_serialization_failed\"}";
        }
    }

    private String generateUnsubscribeToken(String userId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(unsubscribeSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(userId.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hmacBytes);
        } catch (Exception e) {
            log.error("Failed to generate HMAC token", e);
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString((userId + ":unsubscribe").getBytes());
        }
    }

    @Transactional
    public void saveDeliveryAndComplete(Notification notification, String payload) {
        NotificationDelivery delivery = NotificationDelivery.builder()
                .notificationId(notification.getId())
                .channel("EMAIL")
                .status("PENDING_SEND")
                .payload(payload)
                .build();
        deliveryRepository.save(delivery);
        notification.setStatus("COMPOSED");
        notificationRepository.save(notification);
    }

    @Transactional
    public void updateStatus(Notification notification, String status) {
        notification.setStatus(status);
        notificationRepository.save(notification);
    }

    @Transactional
    public void markAsFailed(Notification notification) {
        notification.setStatus("FAILED");
        notificationRepository.save(notification);
    }

    @Scheduled(fixedRateString = "${composition.worker.recovery.rate:600000}")
    @Transactional
    public void recoverStuckClaims() {
        List<Notification> stuck = notificationRepository.findStuckProcessing();
        for (Notification n : stuck) {
            n.setStatus("PENDING_COMPOSITION");
        }
        notificationRepository.saveAll(stuck);
        if (!stuck.isEmpty()) {
            log.warn("Recovered {} stuck compositions", stuck.size());
        }
    }

    // ---- External service calls ----

    private Map<String, Object> fetchUserMeta(String userId) {
        try {
            return restTemplate.getForObject(authServiceUrl + "/auth/users/" + userId + "/meta", Map.class);
        } catch (Exception e) {
            log.error("Failed to fetch user meta for userId {}", userId, e);
            return null;
        }
    }

    /**
     * Fetches per-source completion status from HabitService.
     * Returns a list of maps, each containing: groupId (null for personal), groupName,
     * totalHabits, completedHabits, groupNotificationsEnabled.
     */
    private List<Map<String, Object>> fetchSourceCompletionStatus(String userId) {
        try {
            Map[] result = restTemplate.getForObject(
                    habitServiceUrl + "/habits/users/" + userId + "/completion-status-today",
                    Map[].class
            );
            return result != null ? Arrays.asList(result) : Collections.emptyList();
        } catch (Exception e) {
            log.error("Failed to fetch completion status for userId {}", userId, e);
            return null;
        }
    }

    private Map<String, Object> fetchPersonalConsistencyStats(String userId) {
        try {
            Map result = restTemplate.getForObject(
                    habitServiceUrl + "/habits/users/" + userId + "/consistency",
                    Map.class
            );
            return result != null ? result : Collections.emptyMap();
        } catch (Exception e) {
            log.warn("Failed to fetch consistency stats for userId {}, using zeros", userId, e);
            return Collections.emptyMap();
        }
    }

    private int fetchLiveGroupScore(String userId, String groupId) {
        try {
            Map result = restTemplate.getForObject(
                    groupServiceUrl + "/groups/" + groupId + "/members/" + userId + "/score",
                    Map.class
            );
            return result != null ? (int) result.getOrDefault("coins", 0) : 0;
        } catch (Exception e) {
            log.warn("Failed to fetch live score for userId {} in group {}, using 0", userId, groupId, e);
            return 0;
        }
    }
}

