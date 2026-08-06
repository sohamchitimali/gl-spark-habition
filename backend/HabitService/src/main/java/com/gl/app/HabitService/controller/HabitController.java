package com.gl.app.HabitService.controller;

import com.gl.app.HabitService.dto.CompleteHabitResponse;
import com.gl.app.HabitService.dto.CreateTaskRequest;
import com.gl.app.HabitService.dto.HabitResponse;
import com.gl.app.HabitService.dto.HabitTaskResponse;
import com.gl.app.HabitService.dto.HeatmapResponse;
import com.gl.app.HabitService.dto.StreakResponse;
import com.gl.app.HabitService.service.HabitService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST controller for habit tracking endpoints.
 * User identity is extracted from the {@code X-User-Id} header set by the API Gateway.
 */
@RestController
@Slf4j
public class HabitController {

    @Autowired
    private HabitService habitService;

    // ─── Habit endpoints ──────────────────────────────────────────────────────

    /**
     * Creates a personal (non-group) habit for a user.
     *
     * @param title       the habit title (required)
     * @param description optional description
     * @param userId      the authenticated user ID from gateway header
     * @return 201 Created with the new habit details
     */
    @PostMapping("/habits")
    public ResponseEntity<HabitResponse> createHabit(
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestHeader("X-User-Id") Long userId) {
        return new ResponseEntity<>(habitService.createPersonalHabit(title, description, userId), HttpStatus.CREATED);
    }

    /**
     * Creates a tracking record for a group habit.
     *
     * @param groupId      the group ID
     * @param groupHabitId the group habit ID
     * @param title        the habit title
     * @param description  optional description
     * @param userId       the authenticated user ID from gateway header
     * @return 201 Created with the new habit details
     */
    @PostMapping("/habits/group")
    public ResponseEntity<HabitResponse> createGroupTrackingHabit(
            @RequestParam Long groupId,
            @RequestParam Long groupHabitId,
            @RequestParam String title,
            @RequestParam(required = false) String description,
            @RequestHeader("X-User-Id") Long userId) {
        return new ResponseEntity<>(
                habitService.createGroupTrackingHabit(groupId, groupHabitId, title, description, userId),
                HttpStatus.CREATED
        );
    }

    /**
     * Returns all habits for the authenticated user.
     *
     * @param userId the authenticated user ID from gateway header
     * @return 200 OK with list of habits
     */
    @GetMapping("/habits/users/{userId}")
    public ResponseEntity<List<HabitResponse>> getHabits(@PathVariable Long userId) {
        return ResponseEntity.ok(habitService.getHabitsForUser(userId));
    }

    /**
     * Deletes a habit.
     *
     * @param habitId the habit ID
     * @return 204 No Content
     */
    @DeleteMapping("/habits/{habitId}")
    public ResponseEntity<Void> deleteHabit(@PathVariable Long habitId) {
        habitService.deleteHabit(habitId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Marks a habit as complete for the current day.
     * Requires all tasks on the habit to be completed first.
     *
     * @param habitId the habit ID from path variable
     * @param userId  the authenticated user ID from gateway header
     * @return 200 OK with streak and coin information
     */
    @PostMapping("/habits/{habitId}/complete")
    public ResponseEntity<CompleteHabitResponse> completeHabit(
            @PathVariable Long habitId,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(habitService.completeHabit(habitId, userId));
    }

    // ─── Task endpoints ───────────────────────────────────────────────────────

    /**
     * Adds a task to a habit.
     *
     * @param habitId the habit to attach the task to
     * @param request contains the task title
     * @return 201 Created with the new task
     */
    @PostMapping("/habits/{habitId}/tasks")
    public ResponseEntity<HabitTaskResponse> createTask(
            @PathVariable Long habitId,
            @RequestBody CreateTaskRequest request) {
        return new ResponseEntity<>(habitService.createTask(habitId, request.getTitle()), HttpStatus.CREATED);
    }

    /**
     * Returns all tasks for a habit.
     *
     * @param habitId the habit ID
     * @return 200 OK with list of tasks
     */
    @GetMapping("/habits/{habitId}/tasks")
    public ResponseEntity<List<HabitTaskResponse>> getTasks(@PathVariable Long habitId) {
        return ResponseEntity.ok(habitService.getTasksForHabit(habitId));
    }

    /**
     * Toggles a task's completed status.
     *
     * @param taskId the task ID
     * @return 200 OK with updated task
     */
    @PatchMapping("/habits/tasks/{taskId}/toggle")
    public ResponseEntity<HabitTaskResponse> toggleTask(@PathVariable Long taskId) {
        return ResponseEntity.ok(habitService.toggleTask(taskId));
    }

    /**
     * Deletes a task.
     *
     * @param taskId the task ID
     * @return 204 No Content
     */
    @DeleteMapping("/habits/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long taskId) {
        habitService.deleteTask(taskId);
        return ResponseEntity.noContent().build();
    }

    // ─── User-scoped endpoints (mapped under /users/**) ───────────────────────

    /**
     * Retrieves heatmap data for a specific user.
     *
     * @param userId the user whose heatmap data is requested
     * @return 200 OK with list of daily completion counts
     */
    @GetMapping("/users/{userId}/heatmap")
    public ResponseEntity<HeatmapResponse> getHeatmap(@PathVariable Long userId) {
        return ResponseEntity.ok(habitService.getHeatmap(userId));
    }

    /**
     * Retrieves heatmap data for a specific group.
     *
     * @param groupId the group whose heatmap data is requested
     * @return 200 OK with list of daily completion percentages
     */
    @GetMapping("/groups/{groupId}/heatmap")
    public ResponseEntity<HeatmapResponse> getGroupHeatmap(@PathVariable Long groupId) {
        return ResponseEntity.ok(habitService.getGroupHeatmap(groupId));
    }

    /**
     * Retrieves current and personal best streak for a user.
     *
     * @param userId the user whose streak is requested
     * @return 200 OK with current and best streak values
     */
    @GetMapping("/users/{userId}/streak")
    public ResponseEntity<StreakResponse> getStreak(@PathVariable Long userId) {
        return ResponseEntity.ok(habitService.getStreak(userId));
    }
}
