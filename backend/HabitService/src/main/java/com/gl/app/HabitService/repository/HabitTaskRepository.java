package com.gl.app.HabitService.repository;

import com.gl.app.HabitService.entity.HabitTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link HabitTask} entities.
 */
public interface HabitTaskRepository extends JpaRepository<HabitTask, Long> {

    /** Returns all tasks belonging to a specific habit. */
    List<HabitTask> findByHabitId(Long habitId);

    /** Counts incomplete tasks for a habit. Used to gate habit completion. */
    long countByHabitIdAndCompleted(Long habitId, boolean completed);

    /** Deletes all tasks belonging to a habit. */
    void deleteByHabitId(Long habitId);
}
