package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO containing heatmap data for a user.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeatmapResponse {
    private Long userId;
    private List<HeatmapDay> days;
}
