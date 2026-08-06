package com.gl.app.HabitService.repository;

import com.gl.app.HabitService.entity.Habit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link Habit} entities.
 */
public interface HabitRepository extends JpaRepository<Habit, Long> {

    /**
     * Finds all habits tracked by a specific user.
     *
     * @param userId the user ID
     * @return list of habits for that user
     */
    List<Habit> findByUserId(Long userId);
}
