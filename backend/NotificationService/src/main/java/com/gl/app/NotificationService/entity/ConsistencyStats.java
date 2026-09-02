package com.gl.app.NotificationService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Stores pre-computed rolling sum values for the Consistency Rings UI component.
 *
 * The midnight JobRunr snapshot job writes the immutable historical sums for the last
 * 6 days (weekly), 29 days (monthly), and 364 days (yearly). During the day, the live
 * read combines these sums with today's live percentage in O(1) arithmetic.
 *
 * Scope:
 *   PERSONAL      — a user's consistency across all personal habits
 *   GROUP_MEMBER  — a user's consistency within one specific group
 *   GROUP_GLOBAL  — the entire group's average consistency (all members combined)
 */
@Entity
@Table(name = "consistency_stats", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"entityType", "entityId", "scope"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsistencyStats {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** USER or GROUP */
    @Column(nullable = false, length = 10)
    private String entityType;

    /** userId or groupId depending on entityType + scope */
    @Column(nullable = false)
    private String entityId;

    /** PERSONAL | GROUP_MEMBER | GROUP_GLOBAL */
    @Column(nullable = false, length = 20)
    private String scope;

    /** For GROUP_MEMBER scope: the userId whose bounded consistency this represents. Null for other scopes. */
    @Column(nullable = true)
    private String memberId;

    /** Sum of completion percentages for last 6 completed days (for Weekly ring: + today / 7) */
    @Column(nullable = false)
    private Double histWeeklySum;

    /** Sum of completion percentages for last 29 completed days (for Monthly ring: + today / 30) */
    @Column(nullable = false)
    private Double histMonthlySum;

    /** Sum of completion percentages for last 364 completed days (for Yearly ring: + today / 365) */
    @Column(nullable = false)
    private Double histYearlySum;

    /** The day this snapshot covers. Used to detect stale rows. */
    @Column(nullable = false)
    private LocalDate snapshotDate;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

