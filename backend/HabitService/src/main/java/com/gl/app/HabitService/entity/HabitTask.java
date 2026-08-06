package com.gl.app.HabitService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * JPA entity representing a single subtask within a habit.
 * A habit can have zero or more tasks; it can only be marked complete
 * when all of its tasks are done (or if it has no tasks at all).
 */
@Entity
@Table(name = "habit_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HabitTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "habit_id", nullable = false)
    private Long habitId;

    @Column(nullable = false)
    private String title;

    /** Whether this individual task has been completed today. */
    @Column(nullable = false)
    private boolean completed = false;
}
