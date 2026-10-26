package com.gl.app.HabitService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * JPA entity recording a single daily check-in for a habit by a user.
 * A unique constraint prevents double-completion on the same day.
 */
@Entity
@Table(
    name = "habit_completions",
    uniqueConstraints = @UniqueConstraint(columnNames = {"habit_id", "user_id", "completion_date"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HabitCompletion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "habit_id", nullable = false)
    private Long habitId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** The calendar date on which the habit was completed. */
    @Column(name = "completion_date", nullable = false)
    private LocalDate completionDate;

    /** Exact timestamp of when the completion was recorded. */
    private LocalDateTime completedAt;
}
