package com.gl.app.NotificationService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Transactional Outbox Pattern entity.
 *
 * A record is inserted inside the same @Transactional boundary as the business operation
 * (e.g., scheduling the next notification slot). A separate OutboxSweeper reads PENDING
 * records and submits them safely to JobRunr OSS, providing at-least-once delivery
 * without requiring JobRunr Pro.
 */
@Entity
@Table(name = "job_outbox")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobOutbox {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** The JobRunr job type to enqueue (e.g., "NOTIFICATION_SLOT", "CONSISTENCY_SNAPSHOT"). */
    @Column(nullable = false)
    private String jobType;

    /** JSON payload containing all arguments needed to reconstruct the job. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    /** When this job should be submitted to JobRunr (may be in the future for scheduled slots). */
    @Column(nullable = false)
    private LocalDateTime scheduledAt;

    /** PENDING -> SUBMITTED or DEAD_LETTER */
    @Column(nullable = false)
    private String status; // PENDING | SUBMITTED | DEAD_LETTER | CANCELLED

    @Column(nullable = false)
    private Integer attemptCount;

    @Column(nullable = true)
    private LocalDateTime lastAttemptedAt;

    @Column(nullable = true, columnDefinition = "TEXT")
    private String lastError;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (attemptCount == null) {
            attemptCount = 0;
        }
        if (status == null) {
            status = "PENDING";
        }
    }
}

