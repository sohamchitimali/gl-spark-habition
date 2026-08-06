package com.gl.app.CoinService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO containing the full group leaderboard sorted by coins earned.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardResponse {
    private Long groupId;
    private List<LeaderboardEntry> entries;
    private Long winnerId;
}
