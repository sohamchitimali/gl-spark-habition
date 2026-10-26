package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Response DTO for a single habit task. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HabitTaskResponse {
    private Long id;
    private Long habitId;
    private String title;
    private boolean completed;
}
