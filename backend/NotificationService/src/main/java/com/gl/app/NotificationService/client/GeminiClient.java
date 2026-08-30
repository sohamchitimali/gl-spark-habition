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
            public List<String> habitNames = new ArrayList<>();
        }

        public static class GroupSignal {
            public String groupId;
            public String groupName;
            public int incompleteCount;
            /** Positive = moved up ranks, negative = dropped, 0 = no change */
            public int rankTrajectory;
            public Integer currentRank;
            public long hoursUntilMidnight;
            public String localTimeOfDay;
            public int currentStreak;
            public List<String> habitNames = new ArrayList<>();
        }
    }

    /**
     * The structured JSON output from Gemini.
     */
    public static class RetentionInsightResponse {
        /** The dynamic email subject line */
        public String subject;
        
        /** Personal habits section. Null if personalSignals were null. */
        public String personalPush;

        /**
         * Per-group push messages keyed by groupId.
         * Only contains entries for groups that had incomplete habits.
         */
        public Map<String, String> groupPushes = new HashMap<>();
    }

    /**
     * Asks Gemini to generate a structured retention email JSON.
     *
     * @param payload The signal data for this user's cycle.
     * @return Parsed RetentionInsightResponse from Gemini's JSON output.
     * @throws RuntimeException if Gemini times out, rate-limits, or returns malformed JSON.
     *                          The caller must immediately fall back to RuleBasedFallbackEngine.
     */
    public RetentionInsightResponse generateRetentionInsight(RetentionPromptPayload payload) {
        String promptText = buildPrompt(payload);
        String systemInstruction = """
                You are a concise, friendly habit coach writing retention emails.
                You MUST respond with ONLY a valid JSON object, with NO markdown, NO backticks, NO explanation.
                The JSON must have this exact shape:
                {
                  "subject": "string (A catchy, motivating 3-6 word email subject)",
                  "personalPush": "string or null",
                  "groupPushes": { "groupId": "string", ... }
                }
                Be specific and motivating. Encourage the user to maintain their position or complete habits to try and reach a higher position. Do not call out specific rivals or use negative shame.
                Important formatting rules: 
                - The output MUST use basic HTML tags (like <strong>, <em>, <br>, <ul>, <li>).
                - Address the user by their name (e.g., 'Hi [Name]') without a comma.
                - Format any lists of habits as an HTML unordered list (<ul><li>) instead of inline commas.
                - DO NOT wrap habit names or group names in quotation marks.
                - DO NOT include phrases like 'Complete them in the next X hours' in individual messages; a global footer will handle this.
                - DO NOT mention weekly, monthly, or yearly consistency.
                - DO NOT use any emojis.
                - When rank trajectory is provided (e.g. moved up or dropped), you MUST explicitly mention it to encourage the user.
                - DO NOT wrap the JSON inside markdown blocks.
                Keep each message under 3 sentences (excluding lists). Do not hallucinate any data not provided.
                """;

        String rawResponse = callGeminiApi(promptText, systemInstruction);

        try {
            // Strip any accidental markdown fences if present
            String cleaned = rawResponse
                    .replaceAll("(?s)```json\\s*", "")
                    .replaceAll("(?s)```\\s*", "")
                    .trim();
            return objectMapper.readValue(cleaned, RetentionInsightResponse.class);
        } catch (Exception e) {
            log.error("Gemini returned malformed JSON, falling back to rule engine. Raw: {}", rawResponse);
            throw new RuntimeException("Gemini JSON parse failure", e);
        }
    }

    private String buildPrompt(RetentionPromptPayload payload) {
        StringBuilder sb = new StringBuilder();
        sb.append("Generate a retention email JSON for user '").append(payload.username).append("' with the following data:\n\n");

        if (payload.personalSignals != null) {
            RetentionPromptPayload.PersonalSignals ps = payload.personalSignals;
            String namesStr = ps.habitNames != null && !ps.habitNames.isEmpty() 
                    ? ": '" + String.join("', '", ps.habitNames) + "'" 
                    : "";
            sb.append(String.format(
                    "Personal habits: %d incomplete%s. Current streak: %d days. Weekly consistency: %.1f%%, Monthly: %.1f%%, Yearly: %.1f%%. " +
                    "Local time of day is %s (%d hours until midnight).\n",
                    ps.incompleteCount, namesStr, ps.currentStreak, ps.weeklyConsistency, ps.monthlyConsistency, ps.yearlyConsistency,
                    ps.localTimeOfDay, ps.hoursUntilMidnight
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
                sb.append(String.format(
                        "- Group '%s' (id: %s): %d incomplete habit(s)%s. Current group streak: %d days. Current rank: %d. Rank trajectory: %s. Local time: %s (%d hrs until midnight).\n",
                        gs.groupName, gs.groupId, gs.incompleteCount, namesStr, gs.currentStreak, gs.currentRank, trajectory, gs.localTimeOfDay, gs.hoursUntilMidnight
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

