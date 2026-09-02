package com.gl.app.NotificationService.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Client for the Gemini API.
 *
 * The only public method is {@link #generateRetentionInsight(RetentionPromptPayload)},
 * which asks Gemini to return a strictly structured JSON object for building
 * the retention email. All old "congratulatory message" methods have been removed.
 *
 * Failure contract: any exception (timeout, HTTP error, malformed JSON) propagates
 * as a RuntimeException so the composition worker can immediately fall back to the
 * RuleBasedFallbackEngine without retrying Gemini in the same cycle.
 */
@Component
@Slf4j
public class GeminiClient {

    @Value("${gemini.api.url}")
    private String apiUrl;

    @Value("${gemini.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public GeminiClient() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    /**
     * Payload describing all the deterministic signal data for a single user's notification cycle.
     */
    public static class RetentionPromptPayload {
        public String username;

        /** Null if all personal habits are complete (personal section omitted). */
        public PersonalSignals personalSignals;

        /** One entry per group that has at least 1 incomplete habit. Empty if none. */
        public List<GroupSignal> groupSignals = new ArrayList<>();

        public static class PersonalSignals {
            public int incompleteCount;
            public double weeklyConsistency;
            public double monthlyConsistency;
            public double yearlyConsistency;
            public long hoursUntilMidnight;
            public String localTimeOfDay;
            public int currentStreak;
            public String mostStruggledHabit;
            public List<String> habitNames = new ArrayList<>();
        }

        public static class GroupSignal {
            public String groupId;
            public String groupName;
            public int incompleteCount;
            /** Positive = moved up ranks, negative = dropped, 0 = no change */
            public int rankTrajectory;
            public int currentRank;
            public Integer pointsToNextRank;
            public long hoursUntilMidnight;
            public String localTimeOfDay;
            public int currentStreak;
            public String mostStruggledHabit;
            public List<String> habitNames = new ArrayList<>();
        }
    }

    /**
     * Asks Gemini to generate a short motivational summary.
     *
     * @param payload The signal data for this user's cycle.
     * @return A plain text string containing the AI summary.
     * @throws RuntimeException if Gemini times out or rate-limits.
     */
    public String generateRetentionInsight(RetentionPromptPayload payload) {
        String promptText = buildPrompt(payload);
        String systemInstruction = """
                You are a concise, friendly habit coach. The user is receiving their daily reminder email about their incomplete habits.
                Based on the provided data, write a short, motivational 2-3 sentence summary to place at the very top of the email.
                - Do NOT include any greetings like "Hi [Name]" (this is handled by the template).
                - Do NOT list the habits or groups (the template does this).
                - Just provide the pure motivational text.
                - Keep it encouraging. If they have a high streak, praise it. If they are struggling, encourage them gently.
                - Do NOT use emojis.
                - Do NOT output JSON, just plain text.
                """;

        String rawResponse = callGeminiApi(promptText, systemInstruction);
        if (rawResponse == null || rawResponse.trim().isEmpty()) {
            throw new RuntimeException("Gemini returned empty response");
        }
        
        return rawResponse.trim();
    }

    private String buildPrompt(RetentionPromptPayload payload) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate a retention email JSON for user '").append(payload.username).append("' with the following data:\n\n");

        if (payload.personalSignals != null) {
            RetentionPromptPayload.PersonalSignals ps = payload.personalSignals;
            String namesStr = ps.habitNames != null && !ps.habitNames.isEmpty() 
                    ? ": '" + String.join("', '", ps.habitNames) + "'" 
                    : "";
            String struggleStr = ps.mostStruggledHabit != null && !ps.mostStruggledHabit.isEmpty()
                    ? ". Most struggled habit: '" + ps.mostStruggledHabit + "'"
                    : "";
            sb.append(String.format(
                    "Personal habits: %d incomplete%s. Current streak: %d days. Weekly consistency: %.1f%%, Monthly: %.1f%%, Yearly: %.1f%%. " +
                    "Local time of day is %s (%d hours until midnight)%s.\n",
                    ps.incompleteCount, namesStr, ps.currentStreak, ps.weeklyConsistency, ps.monthlyConsistency, ps.yearlyConsistency,
                    ps.localTimeOfDay, ps.hoursUntilMidnight, struggleStr
            ));
        } else {
            sb.append("Personal habits: all complete (omit personalPush from response, set it to null).\n");
        }

        if (!payload.groupSignals.isEmpty()) {
            sb.append("\nGroup data:\n");
            for (RetentionPromptPayload.GroupSignal gs : payload.groupSignals) {
                String trajectory = gs.rankTrajectory > 0
                        ? "+" + gs.rankTrajectory + " spots (moved up)"
                        : gs.rankTrajectory < 0
                        ? gs.rankTrajectory + " spots (dropped)"
                        : "no rank change";
                String namesStr = gs.habitNames != null && !gs.habitNames.isEmpty() 
                        ? ": '" + String.join("', '", gs.habitNames) + "'" 
                        : "";
                String struggleStr = gs.mostStruggledHabit != null && !gs.mostStruggledHabit.isEmpty()
                        ? ". Most struggled habit: '" + gs.mostStruggledHabit + "'"
                        : "";
                String pointsStr = gs.pointsToNextRank != null
                        ? ". Points to next rank: " + gs.pointsToNextRank
                        : "";
                sb.append(String.format(
                        "- Group '%s' (id: %s): %d incomplete habit(s)%s. Current group streak: %d days. Current rank: %d. Rank trajectory: %s. Local time: %s (%d hrs until midnight)%s%s.\n",
                        gs.groupName, gs.groupId, gs.incompleteCount, namesStr, gs.currentStreak, gs.currentRank, trajectory, gs.localTimeOfDay, gs.hoursUntilMidnight, struggleStr, pointsStr
                ));
            }
        }

        return sb.toString();
    }

    private String callGeminiApi(String promptText, String systemInstructionText) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String urlWithKey = apiUrl + "?key=" + apiKey;

        Map<String, Object> requestBody = new HashMap<>();

        Map<String, Object> part = new HashMap<>();
        part.put("text", promptText);
        Map<String, Object> content = new HashMap<>();
        content.put("parts", Collections.singletonList(part));
        requestBody.put("contents", Collections.singletonList(content));

        if (systemInstructionText != null && !systemInstructionText.isBlank()) {
            Map<String, Object> sysPart = new HashMap<>();
            sysPart.put("text", systemInstructionText);
            Map<String, Object> sysInstruction = new HashMap<>();
            sysInstruction.put("parts", Collections.singletonList(sysPart));
            requestBody.put("systemInstruction", sysInstruction);
        }

        // Force JSON output and disable thinking overhead for this simple task
        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("responseMimeType", "application/json");
        requestBody.put("generationConfig", generationConfig);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

        // Throws RestClientException on HTTP errors — caller must handle
        ResponseEntity<Map> response = restTemplate.postForEntity(urlWithKey, request, Map.class);

        if (response.getBody() == null || !response.getBody().containsKey("candidates")) {
            throw new RuntimeException("Gemini response missing 'candidates' field");
        }

        List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.getBody().get("candidates");
        if (candidates.isEmpty()) {
            throw new RuntimeException("Gemini returned empty candidates list");
        }

        Map<String, Object> contentMap = (Map<String, Object>) candidates.get(0).get("content");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) contentMap.get("parts");
        if (parts == null || parts.isEmpty()) {
            throw new RuntimeException("Gemini returned empty parts list");
        }

        return (String) parts.get(0).get("text");
    }
}

