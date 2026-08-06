package com.gl.app.HabitService.repository;

import com.gl.app.HabitService.entity.HabitCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * Spring Data repository for {@link HabitCompletion} entities.
 */
public interface HabitCompletionRepository extends JpaRepository<HabitCompletion, Long> {

    /**
     * Checks whether a habit was already completed on a given date by a user.
     *
     * @param habitId        the habit ID
     * @param userId         the user ID
     * @param completionDate the date to check
     * @return true if a completion record already exists
     */
    boolean existsByHabitIdAndUserIdAndCompletionDate(Long habitId, Long userId, LocalDate completionDate);

    /**
     * Returns all distinct completion dates for a user, ordered descending.
     * Used for streak and heatmap calculations.
     *
     * @param userId the user ID
     * @return list of unique dates in descending order
     */
    @Query("SELECT DISTINCT hc.completionDate FROM HabitCompletion hc WHERE hc.userId = :userId ORDER BY hc.completionDate DESC")
    List<LocalDate> findDistinctCompletionDatesByUserIdOrderByDesc(@Param("userId") Long userId);

    /**
     * Returns completion counts grouped by date for a user.
     * Used to build heatmap data.
     *
     * @param userId the user ID
     * @return list of [LocalDate, count] pairs
     */
    @Query("SELECT hc.completionDate, COUNT(hc) FROM HabitCompletion hc WHERE hc.userId = :userId GROUP BY hc.completionDate ORDER BY hc.completionDate DESC")
    List<Object[]> countCompletionsByDateForUser(@Param("userId") Long userId);

    /** Deletes all completion records for a habit. */
    void deleteByHabitId(Long habitId);
}
