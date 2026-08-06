package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Represents a single day's completion count for heatmap rendering.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeatmapDay {
    private LocalDate date;
    private int completionCount;
}
