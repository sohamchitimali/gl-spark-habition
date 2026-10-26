package com.gl.app.NotificationService.service;

import com.gl.app.NotificationService.dto.GroupInsightDTO;
import com.gl.app.NotificationService.dto.UserInsightDTO;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Collections;

@Service
public class SignalEngineService {

    /**
     * Computes insights for a specific group based on leaderboard snapshots,
     * habit completion aggregates, and consistency histories.
     *
     * @param groupId the ID of the group
     * @param date    the date for which to compute the insights
     * @return GroupInsightDTO containing computed signals
     */
    public GroupInsightDTO computeGroupInsights(String groupId, LocalDate date) {
        // TODO: Implement rank deltas & overtakes logic
        // TODO: Implement closest-race gap logic
        // TODO: Implement per-habit strong/weak points
        // TODO: Implement trend vs. baseline

        return GroupInsightDTO.builder()
                .groupId(groupId)
                .strongHabits(Collections.emptyList())
                .weakHabits(Collections.emptyList())
                .currentConsistencyRate(0.0)
                .previousConsistencyRate(0.0)
                .consistencyTrend("FLAT")
                .rankMovements(Collections.emptyList())
                .closestRace(null)
                .build();
    }

    /**
     * Computes insights for a specific user based on personal stats history,
     * comeback signals, and recent milestones.
     *
     * @param userId the ID of the user
     * @param date   the date for which to compute the insights
     * @return UserInsightDTO containing computed signals
     */
    public UserInsightDTO computeUserInsights(String userId, LocalDate date) {
        return UserInsightDTO.builder()
                .userId(userId)
                .currentCompletionRate(0.0)
                .previousCompletionRate(0.0)
                .completionTrend("FLAT")
                .streaksAtRisk(Collections.emptyList())
                .recentMilestones(Collections.emptyList())
                .comebackSignal(null)
                .build();
    }
}

