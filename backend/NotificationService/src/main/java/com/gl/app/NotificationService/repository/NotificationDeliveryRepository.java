package com.gl.app.NotificationService.repository;

import com.gl.app.NotificationService.entity.NotificationDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationDeliveryRepository extends JpaRepository<NotificationDelivery, String> {

    @Query(value = "SELECT * FROM notification_deliveries WHERE status = 'PENDING_SEND' OR (status = 'FAILED' AND next_retry_at <= NOW()) LIMIT :batchSize FOR UPDATE SKIP LOCKED", nativeQuery = true)
    List<NotificationDelivery> findPendingForDelivery(int batchSize);
    
    // For stuck-claim recovery
    @Query(value = "SELECT * FROM notification_deliveries WHERE status = 'SENDING' AND created_at < NOW() - INTERVAL '10 minutes'", nativeQuery = true)
    List<NotificationDelivery> findStuckSending();
}

