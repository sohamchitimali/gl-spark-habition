package com.gl.app.HabitService.service;

import com.gl.app.HabitService.client.CoinServiceClient;
import com.gl.app.HabitService.dto.*;
import com.gl.app.HabitService.entity.Habit;
import com.gl.app.HabitService.entity.HabitCompletion;
import com.gl.app.HabitService.entity.HabitTask;
import com.gl.app.HabitService.repository.HabitCompletionRepository;
import com.gl.app.HabitService.repository.HabitRepository;
import com.gl.app.HabitService.repository.HabitTaskRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Business logic for habit tracking: daily completions, streak calculation, and heatmap data.
 * Credits coins to the user on each successful completion via the Coin Service.
 */
@Service
@Slf4j
public class HabitService {

    private static final int BASE_COINS = 10;
    private static final int STREAK_BONUS_COINS = 50;
    private static final int STREAK_BONUS_INTERVAL = 7;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private HabitCompletionRepository completionRepository;

    @Autowired
    private HabitTaskRepository taskRepository;

    @Autowired
    private CoinServiceClient coinServiceClient;

    // ─── Habit CRUD ───────────────────────────────────────────────────────────

    /**
     * Creates a personal habit (not linked to a group).
     *
     * @param title       the habit title
     * @param description optional description (may be null)
     * @param userId      the owning user
     * @return the saved {@link HabitResponse}
     */
    public HabitResponse createPersonalHabit(String title, String description, Long userId) {
        Habit habit = new Habit(null, title, description, userId, null, null);
        Habit saved = habitRepository.save(habit);
        return toHabitResponse(saved);
    }

    /**
     * Creates a tracking habit linked to a specific group habit for a user.
     *
     * @param groupId      the ID of the group
     * @param groupHabitId the ID of the group habit definition
     * @param title        the habit title
     * @param description  optional description
     * @param userId       the user who is tracking it
     * @return the saved {@link HabitResponse}
     */
    public HabitResponse createGroupTrackingHabit(Long groupId, Long groupHabitId, String title, String description, Long userId) {
        Habit habit = new Habit(null, title, description, userId, groupId, groupHabitId);
        Habit saved = habitRepository.save(habit);
        return toHabitResponse(saved);
    }

    /**
     * Returns all habits for a user.
     *
     * @param userId the user ID
     * @return list of habits
     */
    public List<HabitResponse> getHabitsForUser(Long userId) {
        return habitRepository.findByUserId(userId).stream()
                .map(this::toHabitResponse)
                .collect(Collectors.toList());
    }

    /**
     * Deletes a habit and all associated tasks and completion records.
     *
     * @param habitId the ID of the habit to delete
     */
    @Transactional
    public void deleteHabit(Long habitId) {
        if (!habitRepository.existsById(habitId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Habit not found");
        }
        taskRepository.deleteByHabitId(habitId);
        completionRepository.deleteByHabitId(habitId);
        habitRepository.deleteById(habitId);
    }

    // ─── Task CRUD ────────────────────────────────────────────────────────────

    /**
     * Adds a task to a habit.
     *
     * @param habitId the habit to attach the task to
     * @param title   the task title
     * @return the saved {@link HabitTask} as a response DTO
     */
    public HabitTaskResponse createTask(Long habitId, String title) {
        habitRepository.findById(habitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Habit not found"));
        HabitTask task = new HabitTask(null, habitId, title, false);
        HabitTask saved = taskRepository.save(task);
        return toTaskResponse(saved);
    }

    /**
     * Returns all tasks for a habit.
     *
     * @param habitId the habit ID
     * @return list of task response DTOs
     */
    public List<HabitTaskResponse> getTasksForHabit(Long habitId) {
        return taskRepository.findByHabitId(habitId).stream()
                .map(this::toTaskResponse)
                .collect(Collectors.toList());
    }

    /**
     * Toggles a task's completed status.
     *
     * @param taskId the task to toggle
     * @return updated task response DTO
     */
    public HabitTaskResponse toggleTask(Long taskId) {
        HabitTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        task.setCompleted(!task.isCompleted());
        return toTaskResponse(taskRepository.save(task));
    }

    /**
     * Deletes a task.
     *
     * @param taskId the task ID to delete
     */
    public void deleteTask(Long taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
        }
        taskRepository.deleteById(taskId);
    }

    // ─── Habit Completion ─────────────────────────────────────────────────────

    /**
     * Marks a habit as complete for today for the given user.
     * Requires all tasks on the habit to be completed first.
     * Credits coins and applies streak bonuses.
     *
     * @param habitId the habit to complete
     * @param userId  the user performing the completion (from gateway header)
     * @return a {@link CompleteHabitResponse} with streak and coin info
     * @throws ResponseStatusException 404 if habit not found, 409 if already completed, 422 if tasks incomplete
     */
    public CompleteHabitResponse completeHabit(Long habitId, Long userId) {
        log.info("User {} completing habitId={}", userId, habitId);

        Habit habit = habitRepository.findById(habitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Habit not found"));

        LocalDate today = LocalDate.now();
        if (completionRepository.existsByHabitIdAndUserIdAndCompletionDate(habitId, userId, today)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Habit already completed today");
        }

        // Gate: all tasks must be completed before the habit itself can be marked done
        long pendingTasks = taskRepository.countByHabitIdAndCompleted(habitId, false);
        if (pendingTasks > 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Complete all tasks before marking this habit done");
        }

        HabitCompletion completion = new HabitCompletion(null, habitId, userId, today, LocalDateTime.now());
        completionRepository.save(completion);

        int streak = calculateStreak(userId);
        int coinsEarned = 1;
        if (streak > 0 && streak % STREAK_BONUS_INTERVAL == 0) {
            coinsEarned += STREAK_BONUS_COINS;
            log.info("Streak milestone {}! Bonus coins awarded to userId={}", streak, userId);
        }

        coinServiceClient.creditCoins(new CreditCoinsRequest(userId, coinsEarned,
                "Habit completion: " + habit.getTitle(), habit.getGroupId()));

        log.info("User {} completed habit {}. Streak={} Coins={}", userId, habitId, streak, coinsEarned);
        return new CompleteHabitResponse(habitId, today, streak, coinsEarned);
    }

    // ─── Streak ───────────────────────────────────────────────────────────────

    /**
     * Calculates the current consecutive-day streak for a user.
     * A day only counts if ALL of the user's habits were completed on that day.
     *
     * @param userId the user ID
     * @return the number of consecutive fully-completed days up to and including today
     */
    public int calculateStreak(Long userId) {
        List<Habit> habits = habitRepository.findByUserId(userId);
        if (habits.isEmpty()) return 0;
        long totalHabits = habits.size();

        // Get all distinct completion dates with their count of completed habits
        List<Object[]> rawCounts = completionRepository.countCompletionsByDateForUser(userId);

        int streak = 0;
        LocalDate expected = LocalDate.now();

        for (Object[] row : rawCounts) {
            LocalDate date = (LocalDate) row[0];
            long count = ((Number) row[1]).longValue();

            if (date.equals(expected) && count >= totalHabits) {
                streak++;
                expected = expected.minusDays(1);
            } else if (date.isBefore(expected)) {
                // Gap or incomplete day — streak broken
                break;
            }
            // If count < totalHabits on this date, skip without incrementing
        }
        return streak;
    }

    /**
     * Returns streak information for a user, including their personal best.
     *
     * @param userId the user ID
     * @return a {@link StreakResponse} with current and best streak values
     */
    public StreakResponse getStreak(Long userId) {
        int current = calculateStreak(userId);
        int best = calculatePersonalBest(userId);
        return new StreakResponse(userId, current, best);
    }

    /**
     * Returns heatmap data showing completion counts per day for a user.
     *
     * @param userId the user ID
     * @return a {@link HeatmapResponse} with daily completion counts
     */
    public HeatmapResponse getHeatmap(Long userId) {
        List<Object[]> raw = completionRepository.countCompletionsByDateForUser(userId);
        List<HeatmapDay> days = raw.stream()
                .map(row -> new HeatmapDay((LocalDate) row[0], ((Number) row[1]).intValue()))
                .collect(Collectors.toList());
        return new HeatmapResponse(userId, days);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private HabitResponse toHabitResponse(Habit habit) {
        LocalDate today = LocalDate.now();
        boolean completed = completionRepository.existsByHabitIdAndUserIdAndCompletionDate(habit.getId(), habit.getUserId(), today);
        List<HabitTaskResponse> tasks = getTasksForHabit(habit.getId());
        return new HabitResponse(
                habit.getId(),
                habit.getTitle(),
                habit.getDescription(),
                habit.getUserId(),
                habit.getGroupId(),
                habit.getGroupHabitId(),
                completed,
                tasks
        );
    }

    private HabitTaskResponse toTaskResponse(HabitTask t) {
        return new HabitTaskResponse(t.getId(), t.getHabitId(), t.getTitle(), t.isCompleted());
    }

    /**
     * Calculates the personal best (longest ever) streak for a user.
     * Uses the same "all habits done on that day" rule.
     *
     * @param userId the user ID
     * @return the longest consecutive streak recorded
     */
    private int calculatePersonalBest(Long userId) {
        List<Habit> habits = habitRepository.findByUserId(userId);
        if (habits.isEmpty()) return 0;
        long totalHabits = habits.size();

        List<Object[]> rawCounts = completionRepository.countCompletionsByDateForUser(userId);

        // Filter to only fully-completed days
        List<LocalDate> fullDays = rawCounts.stream()
                .filter(row -> ((Number) row[1]).longValue() >= totalHabits)
                .map(row -> (LocalDate) row[0])
                .collect(Collectors.toList());

        if (fullDays.isEmpty()) return 0;

        int best = 1;
        int current = 1;
        for (int i = 0; i < fullDays.size() - 1; i++) {
            if (fullDays.get(i).minusDays(1).equals(fullDays.get(i + 1))) {
                current++;
                best = Math.max(best, current);
            } else {
                current = 1;
            }
        }
        return best;
    }
}
