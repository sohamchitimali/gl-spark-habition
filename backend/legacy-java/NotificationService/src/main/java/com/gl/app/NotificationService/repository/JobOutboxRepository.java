package com.gl.app.NotificationService.repository;

import com.gl.app.NotificationService.entity.JobOutbox;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface JobOutboxRepository extends JpaRepository<JobOutbox, String> {

    /**
     * Claims a batch of PENDING outbox records whose scheduledAt is in the past.
     * Uses SKIP LOCKED so multiple sweeper threads never double-submit the same job.
     */
    @Query(value = """
            SELECT * FROM job_outbox
            WHERE status = 'PENDING'
              AND scheduled_at <= NOW()
            LIMIT :batchSize
            FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<JobOutbox> findPendingForSubmission(int batchSize);

    /**
     * Finds all outbox records for a specific user, used for cascade-cancel on user deletion.
     */
    List<JobOutbox> findByPayloadContainingAndStatusIn(String userIdFragment, List<String> statuses);
}

