package com.gl.app.NotificationService.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gl.app.NotificationService.client.AuthServiceClient;
import com.gl.app.NotificationService.client.GeminiClient;
import com.gl.app.NotificationService.client.GroupServiceClient;
import com.gl.app.NotificationService.client.HabitServiceClient;
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
    private final AuthServiceClient authServiceClient;
    private final HabitServiceClient habitServiceClient;
    private final GroupServiceClient groupServiceClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${habit.service.url}")
    private String habitServiceUrl;

    @Value("${auth.service.url}")
    private String authServiceUrl;

    @Value("${group.service.url}")
    private String groupServiceUrl;

    @Value("${api.gateway.url}")
    private String apiGatewayUrl;

    @Value("${frontend.url}")
    private String frontendUrl;

    @Value("${gemini.unsubscribe.secret:default-dev-secret-key-123456}")
    private String unsubscribeSecret;

    @Scheduled(fixedDelayString = "${composition.worker.delay:5000}")
    public void processPendingCompositions() {
        List<Notification> batch = claimBatch();
        if (batch.isEmpty()) return;

        Map<String, Integer> liveScoreCache = new HashMap<>();

        for (Notification notification : batch) {
            try {
                processSingle(notification, liveScoreCache);
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

    private void processSingle(Notification notification, Map<String, Integer> liveScoreCache) {
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
            if (personalSource.get("mostStruggledHabit") != null) {
                ps.mostStruggledHabit = (String) personalSource.get("mostStruggledHabit");
            }
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
            int liveScore = fetchLiveGroupScore(userId, groupId, liveScoreCache);
            List<LeaderboardSnapshot> snapshot = leaderboardSnapshotRepository.findByGroupId(groupId);

            // Find patched rank for this user
            LeaderboardSnapshot myEntry = snapshot.stream()
                    .filter(e -> e.getUserId().equals(userId))
                    .findFirst().orElse(null);

            myEntry = rankRecalculationService.patchUserRank(myEntry, liveScore);

            int rankTrajectory = 0;
            if (myEntry != null && myEntry.getPreviousRank() != null) {
                rankTrajectory = myEntry.getPreviousRank() - myEntry.getRank();
            }
            
            Integer pointsToNextRank = null;
            if (myEntry != null) {
                final int userScore = myEntry.getScore();
                pointsToNextRank = snapshot.stream()
                    .map(LeaderboardSnapshot::getScore)
                    .filter(score -> score > userScore)
                    .min(Integer::compare)
                    .map(nextScore -> nextScore - userScore)
                    .orElse(null);
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
            gs.pointsToNextRank = pointsToNextRank;
            if (group.get("mostStruggledHabit") != null) {
                gs.mostStruggledHabit = (String) group.get("mostStruggledHabit");
            }
            if (group.get("incompleteHabitNames") != null) {
                List<String> names = (List<String>) group.get("incompleteHabitNames");
                gs.habitNames = names.stream().map(n -> n.replace(".", ".&#8203;")).collect(Collectors.toList());
            }
            promptPayload.groupSignals.add(gs);
        }

        // --- Step 4: Call Gemini for AI Summary ---
        String aiSummary = null;
        try {
            aiSummary = geminiClient.generateRetentionInsight(promptPayload);
        } catch (Exception e) {
            log.warn("Gemini failed to generate summary for userId {}: {}", userId, e.getMessage());
        }

        RuleBasedFallbackEngine.EmailContent content = buildUnifiedEmailBody(promptPayload, aiSummary);
        String emailSubject = content.subject;
        String emailBody = content.body;

        String unsubscribeLink = String.format("%s/notifications/unsubscribe?userId=%s&token=%s", apiGatewayUrl, userId, generateUnsubscribeToken(userId));
        emailBody = wrapInHtml(emailBody, unsubscribeLink, hoursUntilDeadline);

        // --- Step 5: Save delivery atomically ---
        String payload = buildEmailPayload(userEmail, emailSubject, emailBody, userId);
        saveDeliveryAndComplete(notification, payload);
    }

    private RuleBasedFallbackEngine.EmailContent buildUnifiedEmailBody(GeminiClient.RetentionPromptPayload payload, String aiSummary) {
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
            personalSignals.put("mostStruggledHabit", payload.personalSignals.mostStruggledHabit);
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
                    m.put("mostStruggledHabit", gs.mostStruggledHabit);
                    m.put("pointsToNextRank", gs.pointsToNextRank);
                    return m;
                })
                .collect(Collectors.toList());

        return fallbackEngine.buildEmail(username, personalSignals, groupSignals, aiSummary);
    }

    private String wrapInHtml(String contentHtml, String unsubscribeLink, long hoursLeft) {
        return """
        <!DOCTYPE html>
        <html>
        <head>
        </head>
        <body style="margin: 0; padding: 0; background-color: #1a1a1a; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #ffffff;">
            <table width="100%%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #2C2C2A; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
                            <tr>
                                <td align="center" style="padding: 40px 20px 20px;">
                                    <table cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                                        <tr>
                                            <td style="vertical-align: middle;">
                                                <img src="cid:habition-logo" alt="Habition Logo" height="40" style="display: block;" />
                                            </td>
                                            <td style="vertical-align: middle; padding-left: 0px;">
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
                                    <a href="%s/dashboard" style="display: inline-block; background-color: #D0FD3E; color: #1a1a1a; font-weight: 700; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Complete Habits Now</a>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 14px 0 22px 0; background-color: #222220; text-align: center; vertical-align: middle;">
                                    <a href="%s" style="color: #666666; font-size: 12px; line-height: 1; text-decoration: underline; margin: 0; display: inline-block;">Unsubscribe from these emails</a>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """.formatted(hoursLeft, contentHtml.replace("\n", "<br>"), hoursLeft, frontendUrl, unsubscribeLink);
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
            return authServiceClient.getUserMeta(userId);
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
            return habitServiceClient.getCompletionStatusToday(userId);
        } catch (Exception e) {
            log.error("Failed to fetch completion status for userId {}", userId, e);
            return null;
        }
    }

    private Map<String, Object> fetchPersonalConsistencyStats(String userId) {
        try {
            Map<String, Object> result = habitServiceClient.getPersonalConsistency(userId);
            return result != null ? result : Collections.emptyMap();
        } catch (Exception e) {
            log.warn("Failed to fetch consistency stats for userId {}, using zeros", userId, e);
            return Collections.emptyMap();
        }
    }

    private int fetchLiveGroupScore(String userId, String groupId, Map<String, Integer> liveScoreCache) {
        String cacheKey = userId + ":" + groupId;
        if (liveScoreCache.containsKey(cacheKey)) {
            return liveScoreCache.get(cacheKey);
        }

        try {
            Map<String, Object> result = groupServiceClient.getLeaderboard(groupId);
            int score = 0;
            if (result != null && result.containsKey("entries")) {
                java.util.List<Map<String, Object>> entries = (java.util.List<Map<String, Object>>) result.get("entries");
                for (Map<String, Object> entry : entries) {
                    if (String.valueOf(entry.get("userId")).equals(userId)) {
                        score = ((Number) entry.getOrDefault("totalCoins", 0)).intValue();
                        break;
                    }
                }
            }
            liveScoreCache.put(cacheKey, score);
            return score;
        } catch (Exception e) {
            log.warn("Failed to fetch live score for userId {} in group {}, using 0", userId, groupId, e);
            liveScoreCache.put(cacheKey, 0);
            return 0;
        }
    }
}

