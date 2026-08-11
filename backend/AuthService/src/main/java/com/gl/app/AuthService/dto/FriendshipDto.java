package com.gl.app.AuthService.dto;

import com.gl.app.AuthService.entity.FriendshipStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FriendshipDto {
    private Long id;
    private Long friendId; // ID of the friend
    private ProfileDto friendProfile; // The other user in the relationship
    private FriendshipStatus status;
    private Boolean isRequester; // true if the current user initiated the request
    private LocalDateTime createdAt;
}
