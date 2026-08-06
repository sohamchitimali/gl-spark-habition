package com.gl.app.GroupService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO containing full group details including members and habits.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupResponse {

    private Long id;
    private String name;
    private String inviteCode;
    private Long ownerId;
    private List<Long> memberIds;
    private List<GroupHabitResponse> habits;
}
