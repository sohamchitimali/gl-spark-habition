package com.gl.app.GroupService.dto;

import com.gl.app.GroupService.entity.RequestStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SentJoinRequestResponse {
    private Long id;
    private Long groupId;
    private String groupName;
    private Long applicantId;
    private RequestStatus status;
    private String initialMessage;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
