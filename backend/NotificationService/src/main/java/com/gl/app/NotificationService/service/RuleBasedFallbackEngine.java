package com.gl.app.NotificationService.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Rule-Based Fallback Engine.
 *
 * When Gemini times out, rate-limits, or returns unparseable JSON,
 * this engine evaluates the same patched signal data and injects pre-written
 * motivational sentences with substituted values.
 *
 * It is strictly deterministic — no external calls, no randomness.
 */
@Service
@Slf4j
public class RuleBasedFallbackEngine {

    private final String unsubscribeBaseUrl;

    public RuleBasedFallbackEngine(
            @org.springframework.beans.factory.annotation.Value("${app.base-url:http://localhost:8081}") String baseUrl) {
        this.unsubscribeBaseUrl = baseUrl + "/notifications/unsubscribe";
    }

    /**
     * Generates a deterministic retention email body from the given signal data.
     *
     * @param personalSignals Map containing: incompletePersonalCount (int), weeklyConsistency (double),
     *                        monthlyConsistency (double), yearlyConsistency (double). Null if personal habits all complete.
     * @param groupSignals    List of per-group maps. Each map: groupName (String), incompleteCount (int),
     *                        rankTrajectory (int, positive = moved up, negative = dropped), hoursUntilMidnight (long).
     * @param userId          The user ID for building the unsubscribe link.
     * @param unsubscribeToken The signed token for the unsubscribe link.
     * @return A fully composed plaintext email body string.
     */
    public String buildEmailBody(String username,
                                  Map<String, Object> personalSignals,
                                  java.util.List<Map<String, Object>> groupSignals,
                                  String userId,
                                  String unsubscribeToken) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Hi %s<br><br>", username));

        // --- Personal section ---
        if (personalSignals != null) {
            int incompleteCount = (int) personalSignals.get("incompletePersonalCount");
            double weeklyConsistency = (double) personalSignals.get("weeklyConsistency");
            long hoursLeft = (long) personalSignals.get("hoursUntilMidnight");
            String localTime = (String) personalSignals.get("localTimeOfDay");
            int currentStreak = (int) personalSignals.get("currentStreak");
            java.util.List<String> habitNames = (java.util.List<String>) personalSignals.get("habitNames");
            String namesList = "";
            if (habitNames != null && !habitNames.isEmpty()) {
                namesList = "<ul style=\"margin-top: 10px; margin-bottom: 20px;\">";
                for (String h : habitNames) {
                    namesList += "<li>" + h + "</li>";
                }
                namesList += "</ul>";
            }

            String streakMsg = currentStreak > 0 
                    ? String.format(" You are on a <strong>%d-day streak</strong>! ", currentStreak) 
                    : " ";

            sb.append(String.format(
                    "You have %d personal habit%s left for today.%s%s",
                    incompleteCount,
                    incompleteCount > 1 ? "s" : "",
                    streakMsg,
                    namesList
            ));
        }

        // --- Group sections (one per incomplete group) ---
        if (groupSignals != null) {
            for (Map<String, Object> group : groupSignals) {
                String groupName = (String) group.get("groupName");
                int incompleteCount = (int) group.get("incompleteCount");
                int rankTrajectory = (int) group.get("rankTrajectory");
                int currentRank = (int) group.getOrDefault("currentRank", 0);
                long hoursLeft = (long) group.get("hoursUntilMidnight");
                int currentStreak = (int) group.get("currentStreak");
                String localTime = (String) group.get("localTimeOfDay");
                java.util.List<String> habitNames = (java.util.List<String>) group.get("habitNames");
                String namesList = "";
                if (habitNames != null && !habitNames.isEmpty()) {
                    namesList = "<ul style=\"margin-top: 10px; margin-bottom: 20px;\">";
                    for (String h : habitNames) {
                        namesList += "<li>" + h + "</li>";
                    }
                    namesList += "</ul>";
                }

                String streakMsg = currentStreak > 0 
                        ? String.format(" Keep your %d-day group streak alive! ", currentStreak) 
                        : " ";

                if (rankTrajectory < 0) {
                    // User dropped in rank
                    sb.append(String.format(
                            "In group <strong>%s</strong>: You have %d group habit%s left.%s" +
                            "You are currently rank %d (dropped slightly today). Fight back and reach a higher position! 📈%s",
                            groupName,
                            incompleteCount,
                            incompleteCount > 1 ? "s" : "",
                            streakMsg,
                            currentRank,
                            namesList
                    ));
                } else if (rankTrajectory > 0) {
                    // User moved up in rank
                    sb.append(String.format(
                            "In group <strong>%s</strong>: You're on a roll! You climbed %d spot%s and are now rank %d.%sDon't stop — you have %d habit%s " +
                            "left to complete. Maintain your position and keep climbing! 🚀%s",
                            groupName,
                            rankTrajectory,
                            rankTrajectory > 1 ? "s" : "",
                            currentRank,
                            streakMsg,
                            incompleteCount,
                            incompleteCount > 1 ? "s" : "",
                            namesList
                    ));
                } else {
                    // No rank change
                    sb.append(String.format(
                            "In group <strong>%s</strong>: You are currently rank %d. You have %d group habit%s left for today.%s%s",
                            groupName,
                            currentRank,
                            incompleteCount,
                            incompleteCount > 1 ? "s" : "",
                            streakMsg,
                            namesList
                    ));
                }
            }
        }

        return sb.toString();
    }
}

