package com.gl.app.GroupService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * JPA entity representing membership of a user in a {@link Group}.
 */
@Entity
@Table(
    name = "group_members",
    uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "user_id"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupMember {

    public GroupMember(Long id, Long groupId, Long userId, java.time.LocalDateTime joinedAt, Boolean isAdmin) {
        this.id = id;
        this.groupId = groupId;
        this.userId = userId;
        this.joinedAt = joinedAt;
        this.isAdmin = isAdmin;
        this.totalCoins = 0;
        this.previousRank = null;
    }


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Timestamp when the user joined the group. */
    private LocalDateTime joinedAt;

    /** Whether this member has admin privileges. */
    @Column(name = "is_admin", columnDefinition = "boolean default false")
    private Boolean isAdmin = false;

    /** Total coins earned by the user in this group. */
    @Column(name = "total_coins", columnDefinition = "integer default 0")
    private Integer totalCoins = 0;

    /** Previous rank on the leaderboard (for tracking rank changes). */
    @Column(name = "previous_rank")
    private Integer previousRank;
}
