package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HabitResponse {
    private Long id;
    private String title;
    private String description;
    private Long userId;
    private Long groupId;
    private Long groupHabitId;
    private boolean completedToday;
    private List<HabitTaskResponse> tasks;
}
