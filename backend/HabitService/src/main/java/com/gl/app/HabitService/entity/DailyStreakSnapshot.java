package com.gl.app.HabitService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;

@Entity
@Table(name = "daily_streak_snapshots")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DailyStreakSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column
    private Long groupId; // null for personal streak

    @Column(nullable = false)
    private LocalDate snapshotDate;

    @Column(nullable = false)
    private boolean streakEarned;

    @Column(nullable = false)
    private int totalHabits;

    @Column(nullable = false)
    private int completedHabits;
}
