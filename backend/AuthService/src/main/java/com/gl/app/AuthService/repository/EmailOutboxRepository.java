package com.gl.app.AuthService.repository;

import com.gl.app.AuthService.entity.EmailOutboxEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface EmailOutboxRepository extends JpaRepository<EmailOutboxEntity, Long> {

    @Modifying
    @Transactional
    @Query(value = "UPDATE email_outbox SET status = 'PROCESSING', processing_at = NOW() " +
                   "WHERE id IN (" +
                   "  SELECT id FROM email_outbox " +
                   "  WHERE status = 'PENDING' AND next_attempt_at <= NOW() " +
                   "  ORDER BY next_attempt_at ASC " +
                   "  FOR UPDATE SKIP LOCKED " +
                   "  LIMIT :batchSize" +
                   ") RETURNING id", nativeQuery = true)
    List<Long> claimBatch(@Param("batchSize") int batchSize);

    @Modifying
    @Transactional
    @Query(value = "UPDATE email_outbox SET status = 'PROCESSING', processing_at = NOW() " +
                   "WHERE id = :id AND status = 'PENDING'", nativeQuery = true)
    int tryClaimFastPath(@Param("id") Long id);

    @Modifying
    @Transactional
    @Query(value = "UPDATE email_outbox SET status = 'PENDING', processing_at = NULL " +
                   "WHERE status = 'PROCESSING' AND processing_at < NOW() - INTERVAL '15 minutes'", nativeQuery = true)
    int resetStuckProcessingRows();
    
    @Modifying
    @Transactional
    @Query("UPDATE EmailOutboxEntity e SET e.status = :status, e.sentAt = CURRENT_TIMESTAMP WHERE e.id = :id")
    void markAsSent(@Param("id") Long id, @Param("status") String status);
}
