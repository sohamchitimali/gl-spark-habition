package com.gl.app.NotificationService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "leaderboard_snapshots")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaderboardSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String groupId;

    @Column(nullable = false)
    private String userId;

    @Column(name = "\"rank\"", nullable = false)
    private Integer rank;

    /** Rank from the previous snapshot — null if this is the first entry for this user in this group. */
    @Column
    private Integer previousRank;

    @Column(nullable = false)
    private Integer score;

    @Column(nullable = false)
    private LocalDateTime capturedAt;
}

