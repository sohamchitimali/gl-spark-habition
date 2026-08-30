package com.gl.app.NotificationService.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gl.app.NotificationService.entity.JobOutbox;
import com.gl.app.NotificationService.entity.Notification;
import com.gl.app.NotificationService.entity.NotificationSchedule;
import com.gl.app.NotificationService.repository.JobOutboxRepository;
import com.gl.app.NotificationService.repository.NotificationRepository;
import com.gl.app.NotificationService.repository.NotificationScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Manages the lifecycle of NotificationSchedules using the Transactional Outbox Pattern.
 *
 * We do NOT call JobRunr directly here. Instead, we write a JobOutbox record inside the
 * same @Transactional boundary as the schedule update. The OutboxSweeper will submit
 * the actual JobRunr job asynchronously, ensuring crash-proof at-least-once delivery
 * without requiring JobRunr Pro.
 *
 * Settings Immutability Rule: updates to window/frequency NEVER touch an already-computed
 * nextExecutionAt. The current cycle fires as scheduled; new settings take effect on the
 * next cycle computation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationScheduleService {

    private final NotificationScheduleRepository scheduleRepository;
    private final NotificationRepository notificationRepository;
    private final JobOutboxRepository jobOutboxRepository;
    private final SlotMathEngine slotMathEngine;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Creates or re-activates a NotificationSchedule for a new user.
     * Called when the user first enables notifications or registers.
     */
    @Transactional
    public void initializeSchedule(String userId, String ianaTimezone,
                                    String windowStart, String windowEnd, int frequency) {
        String validationError = slotMathEngine.validateWindow(windowStart, windowEnd, frequency);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }

        if (scheduleRepository.existsByUserId(userId)) {
            log.info("Schedule already exists for userId {}", userId);
            return;
        }

        // Compute the first slot
        ZonedDateTime firstSlot = slotMathEngine.computeFirstSlotTomorrow(
                ianaTimezone, windowStart, windowEnd, frequency);

        NotificationSchedule schedule = NotificationSchedule.builder()
                .userId(userId)
                .timezone(ianaTimezone)
                .windowStart(windowStart)
                .windowEnd(windowEnd)
                .frequency(frequency)
                .nextExecutionAt(firstSlot.toLocalDateTime())
                .currentCycleIndex(0)
                .version(0)
                .build();

        scheduleRepository.save(schedule);
        enqueueOutboxJob(schedule, firstSlot, LocalDate.now(ZoneId.of(ianaTimezone)).plusDays(1), 0);
        log.info("Initialized notification schedule for userId {}, first slot at {}", userId, firstSlot);
    }

    /**
     * Updates the user's notification window and frequency settings.
     *
     * CRITICAL: This method does NOT touch nextExecutionAt or currentCycleIndex.
     * The currently scheduled slot fires as-is. New settings are stored and will
     * be applied when the next slot computation runs after the current cycle completes.
     */
    @Transactional
    public void updateSettings(String userId, String ianaTimezone,
                                String windowStart, String windowEnd, int frequency) {
        String validationError = slotMathEngine.validateWindow(windowStart, windowEnd, frequency);
        if (validationError != null) {
            throw new IllegalArgumentException(validationError);
        }

        NotificationSchedule schedule = scheduleRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalStateException("No schedule found for userId " + userId));

        schedule.setTimezone(ianaTimezone);
        schedule.setWindowStart(windowStart);
        schedule.setWindowEnd(windowEnd);
        schedule.setFrequency(frequency);
        // nextExecutionAt and currentCycleIndex are deliberately NOT touched here.
        scheduleRepository.save(schedule);
        log.info("Updated settings for userId {} (current cycle unaffected)", userId);
    }

    /**
     * Called by the JobRunr trigger after a slot fires.
     * Creates the Notification row (PENDING_COMPOSITION) and schedules the next slot.
     */
    @Transactional
    public void onSlotFired(String userId, LocalDate notificationDate, int cycleIndex) {
        log.info("Slot fired for userId {} date {} cycle {}", userId, notificationDate, cycleIndex);

        // Create the PENDING_COMPOSITION row — the SKIP LOCKED worker will pick it up
        Notification notification = Notification.builder()
                .userId(userId)
                .notificationDate(notificationDate)
                .cycleIndex(cycleIndex)
                .status("PENDING_COMPOSITION")
                .build();
        notificationRepository.save(notification);

        // Compute and enqueue the next slot
        Optional<NotificationSchedule> scheduleOpt = scheduleRepository.findByUserId(userId);
        if (scheduleOpt.isEmpty()) {
            log.warn("No schedule found for userId {} after slot fired — cannot schedule next", userId);
            return;
        }

        NotificationSchedule schedule = scheduleOpt.get();
        int nextCycleIndex = cycleIndex + 1;
        ZonedDateTime nextSlot;

        if (nextCycleIndex < schedule.getFrequency()) {
            // More slots remain today
            nextSlot = slotMathEngine.computeNextSlot(
                    schedule.getTimezone(), schedule.getWindowStart(), schedule.getWindowEnd(),
                    schedule.getFrequency(), nextCycleIndex
            );
        } else {
            nextSlot = null;
        }

        if (nextSlot == null) {
            // All slots for today done — schedule first slot tomorrow
            nextSlot = slotMathEngine.computeFirstSlotTomorrow(
                    schedule.getTimezone(), schedule.getWindowStart(), schedule.getWindowEnd(),
                    schedule.getFrequency()
            );
            nextCycleIndex = 0;
            notificationDate = notificationDate.plusDays(1);
        }

        schedule.setNextExecutionAt(nextSlot.toLocalDateTime());
        schedule.setCurrentCycleIndex(nextCycleIndex);
        scheduleRepository.save(schedule);

        enqueueOutboxJob(schedule, nextSlot, notificationDate, nextCycleIndex);
        log.info("Enqueued next slot for userId {} at {}", userId, nextSlot);
    }

    /**
     * Cascade-cancels a user's schedule and all pending outbox jobs.
     * Called when a user account is deleted.
     */
    @Transactional
    public void cancelScheduleForUser(String userId) {
        scheduleRepository.findByUserId(userId).ifPresent(scheduleRepository::delete);
        // Mark matching outbox records as CANCELLED
        jobOutboxRepository.findByPayloadContainingAndStatusIn(
                "\"userId\":\"" + userId + "\"",
                java.util.List.of("PENDING")
        ).forEach(job -> {
            job.setStatus("CANCELLED");
            jobOutboxRepository.save(job);
        });
        log.info("Cascade-cancelled schedule and outbox jobs for userId {}", userId);
    }

    private void enqueueOutboxJob(NotificationSchedule schedule, ZonedDateTime scheduledAt,
                                   LocalDate notificationDate, int cycleIndex) {
        try {
            Map<String, String> payload = new HashMap<>();
            payload.put("userId", schedule.getUserId());
            payload.put("notificationDate", notificationDate.toString());
            payload.put("cycleIndex", String.valueOf(cycleIndex));

            JobOutbox outbox = JobOutbox.builder()
                    .jobType("NOTIFICATION_SLOT")
                    .payload(objectMapper.writeValueAsString(payload))
                    .scheduledAt(scheduledAt.toLocalDateTime())
                    .status("PENDING")
                    .build();
            jobOutboxRepository.save(outbox);
        } catch (Exception e) {
            log.error("Failed to write outbox record for userId {}", schedule.getUserId(), e);
            throw new RuntimeException("Critical: outbox write failed", e);
        }
    }

    /**
     * Triggers an immediate, one-off test notification for the user.
     * Bypasses JobRunr and directly inserts a PENDING_COMPOSITION record.
     */
    @Transactional
    public void triggerTestNotification(String userId) {
        log.info("Triggering instant test notification for userId {}", userId);
        
        // Generate a random negative cycle index to avoid unique constraint collisions 
        // if the user requests multiple test notifications on the same day.
        int testCycleIndex = java.util.concurrent.ThreadLocalRandom.current().nextInt(-1000000, -1);
        
        Notification notification = Notification.builder()
                .userId(userId)
                .notificationDate(LocalDate.now())
                .cycleIndex(testCycleIndex)
                .status("PENDING_COMPOSITION")
                .build();
        notificationRepository.save(notification);
    }
}

