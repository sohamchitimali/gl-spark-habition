package com.gl.app.NotificationService.repository;

import com.gl.app.NotificationService.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

    @Query(value = "SELECT * FROM notifications WHERE status = 'PENDING_COMPOSITION' LIMIT :batchSize FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<Notification> findPendingForComposition(int batchSize);
    
    // For stuck-claim recovery
    @Query(value = "SELECT * FROM notifications WHERE status = 'PROCESSING' AND created_at < NOW() - INTERVAL '10 minutes'", nativeQuery = true)
    List<Notification> findStuckProcessing();
}

