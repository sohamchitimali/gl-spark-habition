package com.gl.app.GroupService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.time.LocalDateTime;

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
    private List<Long> adminIds;
    private List<GroupHabitResponse> habits;
    private String visibility;
    private Boolean hasPendingRequests;
    private Boolean currentUserRequested;
    
    private String description;
    private String duration;
    private LocalDateTime competitionEndDate;
}
