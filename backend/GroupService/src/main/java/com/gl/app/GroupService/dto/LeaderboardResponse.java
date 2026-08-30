package com.gl.app.GroupService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardResponse {
    private Long groupId;
    private List<LeaderboardEntry> entries;
    private Long winnerId;
}
