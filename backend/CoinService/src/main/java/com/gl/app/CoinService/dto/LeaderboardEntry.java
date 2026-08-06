package com.gl.app.CoinService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Single leaderboard entry for one user in a group competition.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardEntry {
    private int rank;
    private Long userId;
    private Integer totalCoins;
}
