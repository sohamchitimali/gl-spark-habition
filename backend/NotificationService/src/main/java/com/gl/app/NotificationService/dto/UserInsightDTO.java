package com.gl.app.NotificationService.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserInsightDTO {
    private String userId;
    private Double currentCompletionRate;
    private Double previousCompletionRate;
    private String completionTrend; // "UP", "DOWN", "FLAT"
    private List<StreakAtRisk> streaksAtRisk;
    private List<MilestoneInsight> recentMilestones;
    private ComebackSignal comebackSignal;

    @Data
    @AllArgsConstructor
    public static class StreakAtRisk {
        private String habitId;
        private Integer currentStreak;
    }

    @Data
    @AllArgsConstructor
    public static class MilestoneInsight {
        private String type;
        private String groupId; // nullable
    }

    @Data
    @AllArgsConstructor
    public static class ComebackSignal {
        private Integer daysMissed;
        private String message;
    }
}

