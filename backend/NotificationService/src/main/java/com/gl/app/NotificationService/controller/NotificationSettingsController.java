package com.gl.app.NotificationService.controller;

import com.gl.app.NotificationService.entity.NotificationSchedule;
import com.gl.app.NotificationService.repository.NotificationScheduleRepository;
import com.gl.app.NotificationService.service.NotificationScheduleService;
import com.gl.app.NotificationService.service.SlotMathEngine;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * REST controller for managing a user's notification preferences.
 *
 * All endpoints read the authenticated user's ID from the X-User-Id gateway header.
 */
@RestController
@RequestMapping("/notifications/settings")
@RequiredArgsConstructor
@Slf4j
public class NotificationSettingsController {

    private final NotificationScheduleService scheduleService;
    private final NotificationScheduleRepository scheduleRepository;
    private final SlotMathEngine slotMathEngine;

    @Data
    public static class NotificationSettingsRequest {
        private String timezone;
        private String windowStart;  // e.g. "18:00"
        private String windowEnd;    // e.g. "22:00"
        private Integer frequency;
    }

    /**
     * GET /notifications/settings — Returns current notification settings for the user.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getSettings(
            @RequestHeader("X-User-Id") String userId) {
        Optional<NotificationSchedule> schedule = scheduleRepository.findByUserId(userId);
        if (schedule.isEmpty()) {
            return ResponseEntity.ok(Map.of("enabled", false));
        }
        NotificationSchedule s = schedule.get();
        Map<String, Object> result = new HashMap<>();
        result.put("enabled", true);
        result.put("timezone", s.getTimezone());
        result.put("windowStart", s.getWindowStart());
        result.put("windowEnd", s.getWindowEnd());
        result.put("frequency", s.getFrequency());
        result.put("nextExecutionAt", s.getNextExecutionAt());
        return ResponseEntity.ok(result);
    }

    /**
     * POST /notifications/settings — Creates the initial notification schedule for the user.
     */
    @PostMapping
    public ResponseEntity<Map<String, String>> createSettings(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody NotificationSettingsRequest request) {
        try {
            scheduleService.initializeSchedule(
                    userId, request.getTimezone(),
                    request.getWindowStart(), request.getWindowEnd(),
                    request.getFrequency()
            );
            return ResponseEntity.ok(Map.of("status", "created"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * PUT /notifications/settings — Updates window/frequency settings.
     * DOES NOT affect the currently scheduled slot (immutability rule).
     */
    @PutMapping
    public ResponseEntity<Map<String, String>> updateSettings(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody NotificationSettingsRequest request) {
        try {
            scheduleService.updateSettings(
                    userId, request.getTimezone(),
                    request.getWindowStart(), request.getWindowEnd(),
                    request.getFrequency()
            );
            return ResponseEntity.ok(Map.of("status", "updated", "note",
                    "Settings will take effect from your next scheduled cycle"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * DELETE /notifications/settings — Disables notifications for the user.
     * Cascade-cancels schedule and pending outbox jobs.
     */
    @DeleteMapping
    public ResponseEntity<Map<String, String>> deleteSettings(
            @RequestHeader("X-User-Id") String userId) {
        scheduleService.cancelScheduleForUser(userId);
        return ResponseEntity.ok(Map.of("status", "cancelled"));
    }

    /**
     * GET /notifications/settings/validate — Validates a window + frequency combination
     * without saving, used by the frontend slider to give live feedback.
     */
    @GetMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateWindow(
            @RequestParam String windowStart,
            @RequestParam String windowEnd,
            @RequestParam int frequency) {
        String error = slotMathEngine.validateWindow(windowStart, windowEnd, frequency);
        Map<String, Object> result = new HashMap<>();
        result.put("valid", error == null);
        if (error != null) {
            result.put("error", error);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * POST /notifications/settings/test — Triggers an immediate, one-off test notification
     * to verify email delivery is working.
     */
    @PostMapping("/test")
    public ResponseEntity<Map<String, String>> triggerTestNotification(
            @RequestHeader("X-User-Id") String userId) {
        scheduleService.triggerTestNotification(userId);
        return ResponseEntity.ok(Map.of("status", "test_triggered"));
    }
}

