package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO containing streak information for a user.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StreakResponse {
    private Long userId;
    private int currentStreak;
    private int personalBest;
}
