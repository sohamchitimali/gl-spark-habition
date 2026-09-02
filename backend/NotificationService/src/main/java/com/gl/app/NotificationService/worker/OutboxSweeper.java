package com.gl.app.NotificationService.worker;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gl.app.NotificationService.entity.JobOutbox;
import com.gl.app.NotificationService.repository.JobOutboxRepository;
import com.gl.app.NotificationService.service.NotificationScheduleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jobrunr.scheduling.JobScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Outbox Sweeper — the bridge between the Transactional Outbox table and JobRunr OSS.
 *
 * Runs every 30 seconds. Claims PENDING outbox records whose scheduledAt is in the past
 * via SKIP LOCKED, then submits the actual JobRunr job. This decouples the transactional
 * safety guarantee (DB-first write) from the actual job submission.
 *
 * Retry policy:
 * - Max 5 attempts with exponential backoff (30s, 1m, 2m, 4m, 8m).
 * - After 5 failures the record is marked DEAD_LETTER and logged for alerting.
 *
 * Idempotency note: the Notification row has a UNIQUE constraint on (userId, notificationDate, cycleIndex).
 * If the outbox is submitted twice (at-least-once guarantee), the second insert is silently ignored.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxSweeper {

    private static final int BATCH_SIZE = 50;
    private static final int MAX_ATTEMPTS = 5;

    private final JobOutboxRepository jobOutboxRepository;
    private final JobScheduler jobScheduler;
    private final NotificationScheduleService notificationScheduleService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Scheduled(fixedDelay = 30_000) // every 30 seconds
    public void sweep() {
        List<JobOutbox> batch = claimBatch();
        if (batch.isEmpty()) return;

        log.debug("OutboxSweeper claiming {} jobs", batch.size());
        for (JobOutbox job : batch) {
            try {
                submitToJobRunr(job);
                markSubmitted(job);
            } catch (Exception e) {
                log.error("Failed to submit outbox job {}", job.getId(), e);
                handleRetryOrDeadLetter(job, e);
            }
        }
    }

    @Transactional
    public List<JobOutbox> claimBatch() {
        return jobOutboxRepository.findPendingForSubmission(BATCH_SIZE);
    }

    private void submitToJobRunr(JobOutbox job) throws Exception {
        if ("NOTIFICATION_SLOT".equals(job.getJobType())) {
            Map payload = objectMapper.readValue(job.getPayload(), Map.class);
            String userId = (String) payload.get("userId");
            LocalDate notificationDate = LocalDate.parse((String) payload.get("notificationDate"));
            int cycleIndex = Integer.parseInt(String.valueOf(payload.get("cycleIndex")));

            // Schedule in JobRunr at the exact time from the outbox record
            LocalDateTime scheduledAt = job.getScheduledAt();
            jobScheduler.schedule(scheduledAt,
                    () -> notificationScheduleService.onSlotFired(userId, notificationDate, cycleIndex));
        } else {
            throw new IllegalArgumentException("Unknown job type: " + job.getJobType());
        }
    }

    @Transactional
    public void markSubmitted(JobOutbox job) {
        job.setStatus("SUBMITTED");
        job.setLastAttemptedAt(LocalDateTime.now());
        jobOutboxRepository.save(job);
    }

    @Transactional
    public void handleRetryOrDeadLetter(JobOutbox job, Exception e) {
        int attempts = job.getAttemptCount() + 1;
        job.setAttemptCount(attempts);
        job.setLastAttemptedAt(LocalDateTime.now());
        job.setLastError(e.getMessage());

        if (attempts >= MAX_ATTEMPTS) {
            job.setStatus("DEAD_LETTER");
            log.error("DEAD_LETTER: Outbox job {} failed {} times, giving up. Payload: {}",
                    job.getId(), attempts, job.getPayload());
        } else {
            // Exponential backoff: 30s, 1m, 2m, 4m, 8m
            long backoffSeconds = (long) Math.pow(2, attempts - 1) * 30;
            job.setScheduledAt(LocalDateTime.now().plusSeconds(backoffSeconds));
            job.setStatus("PENDING");
        }

        jobOutboxRepository.save(job);
    }
}

