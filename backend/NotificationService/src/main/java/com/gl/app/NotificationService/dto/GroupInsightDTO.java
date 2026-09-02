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
public class GroupInsightDTO {
    private String groupId;
    private List<HabitPerformance> strongHabits;
    private List<HabitPerformance> weakHabits;
    private Double currentConsistencyRate;
    private Double previousConsistencyRate;
    private String consistencyTrend; // e.g., "UP", "DOWN", "FLAT"
    private List<RankMovement> rankMovements;
    private ClosestRace closestRace;

    @Data
    @AllArgsConstructor
    public static class HabitPerformance {
        private String habitId;
        private Double completionRate;
    }

    @Data
    @AllArgsConstructor
    public static class RankMovement {
        private String userId;
        private Integer previousRank;
        private Integer currentRank;
        private Integer delta;
    }

    @Data
    @AllArgsConstructor
    public static class ClosestRace {
        private String user1Id;
        private String user2Id;
        private Integer scoreGap;
    }
}

