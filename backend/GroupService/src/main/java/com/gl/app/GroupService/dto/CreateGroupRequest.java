package com.gl.app.GroupService.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request DTO for creating a new habit group.
 */
@Data
public class CreateGroupRequest {

    /** Name of the group to create. */
    @NotBlank(message = "Group name must not be blank")
    private String name;
    
    private String description;
    
    private String visibility;
    private Integer years;
    private Integer months;
    private Integer weeks;
    private Integer days;
    
    private java.util.List<Long> inviteFriendIds;
}
