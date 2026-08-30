package com.gl.app.GroupService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardEntry {
    private Integer rank;
    private Integer previousRank;
    private Long userId;
    private Integer totalCoins;
}
