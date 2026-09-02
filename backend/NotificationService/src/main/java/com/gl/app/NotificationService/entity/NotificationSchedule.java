package com.gl.app.NotificationService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "notification_schedules")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, unique = true)
    private String userId;

    @Column(nullable = false)
    private String timezone;

    @Column(nullable = false)
    private String windowStart;

    @Column(nullable = false)
    private String windowEnd;

    @Column(nullable = false)
    private Integer frequency;

    @Column(nullable = false)
    private LocalDateTime nextExecutionAt;

    @Column(nullable = false)
    private Integer currentCycleIndex;

    @Version
    @Column(nullable = false)
    private Integer version;
}

