package com.gl.app.HabitService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * JPA entity representing the daily task completion percentage
 * for a user's personal habits or a group's habits.
 */
@Entity
@Table(name = "heatmap_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HeatmapRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Null if this is a group record. */
    private Long userId;

    /** Null if this is a personal record. */
    private Long groupId;

    @Column(nullable = false)
    private LocalDate recordDate;

    @Column(nullable = false)
    private int totalTasks;

    @Column(nullable = false)
    private int completedTasks;

    @Column(nullable = false)
    private int completionPercentage;
}
