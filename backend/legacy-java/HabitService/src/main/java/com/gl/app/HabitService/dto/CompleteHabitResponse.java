package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Response DTO returned when a habit is successfully completed.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompleteHabitResponse {
    private Long habitId;
    private LocalDate completedOn;
    private int currentStreak;
    private int coinsEarned;
}
