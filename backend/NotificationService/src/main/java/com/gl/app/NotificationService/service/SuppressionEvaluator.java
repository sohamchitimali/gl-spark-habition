package com.gl.app.NotificationService.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Suppression Evaluator — determines whether a notification should be suppressed entirely.
 *
 * Two-step check:
 *
 * Step 1 — Full Suppression:
 *   Query HabitService for all of the user's habits (personal + all group habits).
 *   If EVERY single habit is complete → suppress the notification for this cycle.
 *   This is a single O(1) endpoint call — no per-habit loops.
 *
 * Step 2 — Group-level filter:
 *   For remaining incomplete habits, group them by source (personal / groupId).
 *   Any group whose notificationsEnabled == false is silently excluded.
 *   Any group where ALL habits are complete is silently excluded.
 *   The email content only references the sources that actually have incomplete habits.
 *
 * This class provides Step 1 and returns the filtered source list for Step 2,
 * which the composition worker then builds signals from.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SuppressionEvaluator {

    private final RestTemplate restTemplate;

    @Value("${habit.service.url:http://localhost:8082}")
    private String habitServiceUrl;

    /**
     * Result of suppression evaluation.
     */
    public static class EvaluationResult {
        /** True if the notification should be entirely suppressed (all habits done). */
        public final boolean fullySuppress;

        /**
         * Filtered list of sources with incomplete habits.
         * Each map contains: groupId (null for personal), groupName,
         * totalHabits, completedHabits, groupNotificationsEnabled.
         * Only present when fullySuppress == false.
         */
        public final List<Map<String, Object>> incompleteSources;

        /** True if personal habits are among the incomplete sources. */
        public final boolean personalIncomplete;

        public EvaluationResult(boolean fullySuppress,
                                 List<Map<String, Object>> incompleteSources,
                                 boolean personalIncomplete) {
            this.fullySuppress = fullySuppress;
            this.incompleteSources = incompleteSources;
            this.personalIncomplete = personalIncomplete;
        }

        public static EvaluationResult suppress() {
            return new EvaluationResult(true, java.util.Collections.emptyList(), false);
        }
    }

    /**
     * Evaluates suppression for a given user.
     *
     * @param userId The user ID string.
     * @return EvaluationResult with suppression decision and filtered source list.
     */
    public EvaluationResult evaluate(String userId) {
        // Fetch completion status for all sources (personal + groups) from HabitService
        List<Map<String, Object>> sourceStatus = fetchSourceCompletionStatus(userId);

        if (sourceStatus == null || sourceStatus.isEmpty()) {
            log.info("No habits found for userId {}, suppressing", userId);
            return EvaluationResult.suppress();
        }

        // Step 1: Full suppression check
        boolean allComplete = sourceStatus.stream().allMatch(s -> {
            int total = safeInt(s, "totalHabits");
            int done = safeInt(s, "completedHabits");
            return total > 0 && total == done;
        });

        if (allComplete) {
            log.info("Full suppression for userId {} — all habits complete", userId);
            return EvaluationResult.suppress();
        }

        // Step 2: Filter to sources with remaining work, respecting notificationsEnabled
        // Personal source (groupId == null)
        Map<String, Object> personalSource = sourceStatus.stream()
                .filter(s -> s.get("groupId") == null)
                .findFirst().orElse(null);

        boolean personalIncomplete = personalSource != null
                && safeInt(personalSource, "completedHabits") < safeInt(personalSource, "totalHabits");

        // Group sources: only those with notifications enabled AND incomplete habits
        List<Map<String, Object>> incompleteGroupSources = sourceStatus.stream()
                .filter(s -> s.get("groupId") != null)
                .filter(s -> Boolean.TRUE.equals(s.get("groupNotificationsEnabled")))
                .filter(s -> safeInt(s, "completedHabits") < safeInt(s, "totalHabits"))
                .collect(java.util.stream.Collectors.toList());

        // If nothing remains after group-level filtering + personal
        if (!personalIncomplete && incompleteGroupSources.isEmpty()) {
            log.info("All actionable sources suppressed for userId {} — notifications off or all complete", userId);
            return EvaluationResult.suppress();
        }

        // Build the final incomplete sources list
        java.util.List<Map<String, Object>> incompleteSources = new java.util.ArrayList<>();
        if (personalIncomplete && personalSource != null) {
            incompleteSources.add(personalSource);
        }
        incompleteSources.addAll(incompleteGroupSources);

        return new EvaluationResult(false, incompleteSources, personalIncomplete);
    }

    /**
     * Fetches per-source today's completion status from HabitService.
     * Returns null on network error.
     */
    private List<Map<String, Object>> fetchSourceCompletionStatus(String userId) {
        try {
            Map[] result = restTemplate.getForObject(
                    habitServiceUrl + "/habits/users/" + userId + "/completion-status-today",
                    Map[].class
            );
            return result != null ? Arrays.asList(result) : java.util.Collections.emptyList();
        } catch (Exception e) {
            log.error("Failed to fetch completion status for userId {}: {}", userId, e.getMessage());
            return null;
        }
    }

    private int safeInt(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).intValue();
        return 0;
    }
}

