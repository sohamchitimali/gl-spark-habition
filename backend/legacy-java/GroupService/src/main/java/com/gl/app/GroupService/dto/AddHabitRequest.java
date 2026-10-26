package com.gl.app.GroupService.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request DTO for adding a habit/task to a group.
 */
@Data
public class AddHabitRequest {

    /** Title/name of the habit task. */
    @NotBlank(message = "Habit title must not be blank")
    private String title;

    /** Optional description or instructions for the habit. */
    private String description;
}
