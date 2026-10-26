package com.gl.app.GroupService.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request DTO for joining a group via invite code.
 */
@Data
public class JoinGroupRequest {

    /** The unique invite code of the group to join. */
    @NotBlank(message = "Invite code must not be blank")
    private String inviteCode;
}
