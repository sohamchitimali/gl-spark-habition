package com.gl.app.HabitService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * JPA entity representing a personal habit tracker instance for a user.
 * Links to the group-level habit definition via {@code groupHabitId}.
 */
@Entity
@Table(name = "habits")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Habit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    /** Optional description explaining the habit goal. */
    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Long userId;

    /** ID of the group this habit belongs to; null for personal habits. */
    private Long groupId;

    /** Reference to the GroupService's group_habits table (denormalized). */
    private Long groupHabitId;

    @Column(updatable = false)
    private java.time.LocalDate createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = java.time.LocalDate.now();
        }
    }
}

