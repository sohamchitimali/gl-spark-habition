package com.gl.app.NotificationService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "notification_deliveries", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"notificationId", "channel"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String notificationId;

    @Column(nullable = false)
    private String channel; // EMAIL | IN_APP | PUSH

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload; // Stored as JSON string

    @Column(nullable = false)
    private String status; // PENDING_SEND | SENDING | PROCESSED | FAILED | CANCELLED

    @Column(nullable = false)
    private Integer retryCount;

    @Column(nullable = true)
    private LocalDateTime nextRetryAt;

    @Column(nullable = true, columnDefinition = "TEXT")
    private String lastError;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = true)
    private LocalDateTime processedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (retryCount == null) {
            retryCount = 0;
        }
    }
}

