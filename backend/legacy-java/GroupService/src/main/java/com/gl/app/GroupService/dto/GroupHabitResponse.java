package com.gl.app.GroupService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for a single group habit/task.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupHabitResponse {
    private Long id;
    private String title;
    private String description;
}
