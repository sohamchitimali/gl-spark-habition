package com.gl.app.NotificationService.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Random;

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

    private static final List<String> SUBJECTS = List.of(
        "Your streak is on the line",
        "A few hours left to keep today's streak",
        "Don't lose today's progress",
        "Your habits are still waiting",
        "You're one habit away from a perfect day",
        "The clock's ticking on today's goals",
        "Your group is still counting on you",
        "Almost there — finish today strong",
        "Today's not done yet",
        "Quick reminder before your streak resets",
        "You've come this far — don't stop now",
        "Your leaderboard spot isn't safe yet"
    );

    private final Random random = new Random();

    public static class EmailContent {
        public String subject;
        public String body;
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
    public EmailContent buildEmail(String username,
                                  Map<String, Object> personalSignals,
                                  java.util.List<Map<String, Object>> groupSignals,
                                  String aiSummary) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Hi %s<br><br>", username));

        if (aiSummary != null && !aiSummary.isBlank()) {
            sb.append(String.format("<p style=\"font-size: 15px; color: #a0aec0; margin-bottom: 24px; font-style: italic;\">%s</p>", aiSummary));
        }

        // --- Personal section ---
        if (personalSignals != null) {
            int incompleteCount = (int) personalSignals.get("incompletePersonalCount");
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

            String struggleMsg = "";
            String mostStruggledHabit = (String) personalSignals.get("mostStruggledHabit");
            if (mostStruggledHabit != null && !mostStruggledHabit.isEmpty()) {
                struggleMsg = String.format("<br><br>💡 <strong>Tip:</strong> I noticed you often skip '<strong>%s</strong>'. Try knocking that one out first today to build momentum!", mostStruggledHabit);
            }

            sb.append(String.format(
                    "You have %d personal habit%s left for today.%s%s%s",
                    incompleteCount,
                    incompleteCount > 1 ? "s" : "",
                    streakMsg,
                    struggleMsg,
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
                int currentStreak = (int) group.get("currentStreak");
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
                String pointsMsg = "";
                Integer pointsToNextRank = (Integer) group.get("pointsToNextRank");
                if (pointsToNextRank != null) {
                    pointsMsg = String.format(" You are only %d points behind the next rank!", pointsToNextRank);
                }

                if (rankTrajectory < 0) {
                    // User dropped in rank
                    sb.append(String.format(
                            "In group <strong>%s</strong>: You have %d group habit%s left.%s" +
                            "You are currently rank %d (dropped slightly today). Fight back and reach a higher position!%s 📈%s",
                            groupName,
                            incompleteCount,
                            incompleteCount > 1 ? "s" : "",
                            streakMsg,
                            currentRank,
                            pointsMsg,
                            namesList
                    ));
                } else if (rankTrajectory > 0) {
                    // User moved up in rank
                    sb.append(String.format(
                            "In group <strong>%s</strong>: You're on a roll! You climbed %d spot%s and are now rank %d.%sDon't stop — you have %d habit%s " +
                            "left to complete. Maintain your position and keep climbing!%s 🚀%s",
                            groupName,
                            rankTrajectory,
                            rankTrajectory > 1 ? "s" : "",
                            currentRank,
                            streakMsg,
                            incompleteCount,
                            incompleteCount > 1 ? "s" : "",
                            pointsMsg,
                            namesList
                    ));
                } else {
                    // Rank stayed the same
                    sb.append(String.format(
                            "In group <strong>%s</strong>: You are currently rank %d. You have %d group habit%s left for today.%s%s%s",
                            groupName,
                            currentRank,
                            incompleteCount,
                            incompleteCount > 1 ? "s" : "",
                            streakMsg,
                            pointsMsg,
                            namesList
                    ));
                }
            }
        }

        EmailContent content = new EmailContent();
        content.subject = SUBJECTS.get(random.nextInt(SUBJECTS.size()));
        content.body = sb.toString();
        return content;
    }
}

