package com.gl.app.HabitService.repository;

import com.gl.app.HabitService.entity.DailyStreakSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyStreakSnapshotRepository extends JpaRepository<DailyStreakSnapshot, Long> {

    @Query("SELECT s FROM DailyStreakSnapshot s WHERE s.userId = :userId AND s.groupId IS NULL AND s.snapshotDate = :date")
    Optional<DailyStreakSnapshot> findPersonalSnapshot(@Param("userId") Long userId, @Param("date") LocalDate date);

    @Query("SELECT s FROM DailyStreakSnapshot s WHERE s.userId = :userId AND s.groupId = :groupId AND s.snapshotDate = :date")
    Optional<DailyStreakSnapshot> findGroupSnapshot(@Param("userId") Long userId, @Param("groupId") Long groupId, @Param("date") LocalDate date);

    @Query("SELECT s FROM DailyStreakSnapshot s WHERE s.userId = :userId AND s.groupId IS NULL AND s.streakEarned = true ORDER BY s.snapshotDate DESC")
    List<DailyStreakSnapshot> findPersonalEarnedSnapshotsDesc(@Param("userId") Long userId);

    @Query("SELECT s FROM DailyStreakSnapshot s WHERE s.userId = :userId AND s.groupId = :groupId AND s.streakEarned = true ORDER BY s.snapshotDate DESC")
    List<DailyStreakSnapshot> findGroupEarnedSnapshotsDesc(@Param("userId") Long userId, @Param("groupId") Long groupId);
}
