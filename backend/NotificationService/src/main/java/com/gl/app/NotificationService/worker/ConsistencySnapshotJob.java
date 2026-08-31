package com.gl.app.NotificationService.worker;

import com.gl.app.NotificationService.entity.ConsistencyStats;
import com.gl.app.NotificationService.repository.ConsistencyStatsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jobrunr.jobs.annotations.Job;
import org.jobrunr.scheduling.JobScheduler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.gl.app.NotificationService.client.HabitServiceClient;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Midnight Consistency Snapshot Job.
 *
 * Runs once at midnight UTC to advance all ConsistencyStats rolling sums
 * by one day. Instead of re-reading all historical habit data (expensive),
 * this job:
 *   1. Fetches today's final completion percentage from HabitService (a single O(1) value per user)
 *   2. Adds it to the running sums (weekly/monthly/yearly hist)
 *   3. Updates the snapshotDate to today
 *
 * Rolling sum formula (maintained here):
 *   histYearlySum += todayPercentage   → yields last 365 days total
 *   histMonthlySum += todayPercentage  → yields last 30 days total
 *   histWeeklySum += todayPercentage   → yields last 7 days total
 *
 * Live read formula (used by the UI):
 *   yearly  = (histYearlySum  + liveToday) / 365
 *   monthly = (histMonthlySum + liveToday) / 30
 *   weekly  = (histWeeklySum  + liveToday) / 7
 *
 * Downtime / staleness recovery:
 *   If snapshotDate is more than 1 day behind today, the rows are stale.
 *   We discard them and trigger a full recompute from HabitService instead
 *   of retroactively adding fake zeroes. This keeps the data honest.
 *
 * No grace period logic — this class only updates the pre-computed sums.
 * Grace period logic lives exclusively in the overall consistency score
 * calculation (which is outside this class).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ConsistencySnapshotJob {

    private final ConsistencyStatsRepository consistencyStatsRepository;
    private final HabitServiceClient habitServiceClient;
    private final JobScheduler jobScheduler;

    /**
     * Spring cron triggers this at noon UTC daily.
     * At 12:00 PM UTC, the previous day is 100% over globally (it's Midnight in UTC-12, the last timezone).
     * It enqueues the actual snapshot logic as a JobRunr job so it benefits from
     * JobRunr's retry policy if HabitService is momentarily unavailable.
     */
    @Scheduled(cron = "0 0 12 * * *") // noon UTC
    public void scheduleMidnightSnapshot() {
        log.info("ConsistencySnapshotJob: scheduling midnight snapshot via JobRunr");
        jobScheduler.enqueue(() -> runSnapshot(LocalDate.now().minusDays(1).toString()));
    }

    /**
     * The actual snapshot logic, runs inside JobRunr (with its own retry).
     *
     * @param dateStr The date whose final completion percentage we are snapshotting (yesterday's date)
     */
    @Job(name = "Consistency Midnight Snapshot")
    @Transactional
    public void runSnapshot(String dateStr) {
        LocalDate snapshotDate = LocalDate.parse(dateStr);
        log.info("ConsistencySnapshotJob: running snapshot for date {}", snapshotDate);

        List<ConsistencyStats> allStats = consistencyStatsRepository.findAll();

        for (ConsistencyStats stats : allStats) {
            try {
                advanceRollingSum(stats, snapshotDate);
            } catch (Exception e) {
                log.error("Failed to advance rolling sum for entityId={} scope={}",
                        stats.getEntityId(), stats.getScope(), e);
                // Continue with other rows — individual failures don't abort the whole snapshot
            }
        }
    }

    private void advanceRollingSum(ConsistencyStats stats, LocalDate snapshotDate) {
        // Staleness check: if more than 1 day behind, discard and let it recompute on first read
        if (stats.getSnapshotDate() != null && stats.getSnapshotDate().isBefore(snapshotDate.minusDays(1))) {
            log.warn("Stale ConsistencyStats for entityId={} scope={} — snapshot is {} days behind, discarding for recompute",
                    stats.getEntityId(), stats.getScope(),
                    snapshotDate.toEpochDay() - stats.getSnapshotDate().toEpochDay());
            consistencyStatsRepository.delete(stats);
            return;
        }

        // Fetch the final completion percentage for the previous day
        double yesterdayPercentage = fetchDayCompletionPercentage(stats, snapshotDate);

        // Advance all three running sums
        stats.setHistYearlySum(stats.getHistYearlySum() + yesterdayPercentage);
        stats.setHistMonthlySum(stats.getHistMonthlySum() + yesterdayPercentage);
        stats.setHistWeeklySum(stats.getHistWeeklySum() + yesterdayPercentage);
        stats.setSnapshotDate(snapshotDate);
        stats.setUpdatedAt(LocalDateTime.now());

        consistencyStatsRepository.save(stats);
    }

    /**
     * Fetches the final (end-of-day) completion percentage for a given entity and date.
     * Returns 0.0 on failure so the rolling sum is conservative, not inflated.
     */
    private double fetchDayCompletionPercentage(ConsistencyStats stats, LocalDate date) {
        try {
            Map<String, Object> result;
            String dateStr = date.toString();
            if ("PERSONAL".equals(stats.getScope())) {
                result = habitServiceClient.getPersonalDailyCompletion(stats.getEntityId(), dateStr);
            } else if ("GROUP_MEMBER".equals(stats.getScope())) {
                result = habitServiceClient.getGroupMemberDailyCompletion(stats.getMemberId(), stats.getEntityId(), dateStr);
            } else {
                // GROUP_GLOBAL: fetch group-wide average from GroupService
                result = habitServiceClient.getGroupDailyCompletion(stats.getEntityId(), dateStr);
            }
            if (result != null && result.containsKey("completionPercentage")) {
                Object val = result.get("completionPercentage");
                return val instanceof Number ? ((Number) val).doubleValue() : 0.0;
            }
        } catch (Exception e) {
            log.warn("Failed to fetch daily completion for entityId={} scope={} date={}: {}",
                    stats.getEntityId(), stats.getScope(), date, e.getMessage());
        }
        return 0.0;
    }

    /**
     * Called by the notification composition worker (and the UI consistency endpoint)
     * to get a live O(1) read of the three consistency ring percentages.
     *
     * This is a pure computation — no DB write.
     *
     * @param stats         The pre-computed rolling sum row
     * @param todayLivePct  Today's current (live) completion percentage (0–100)
     * @return A three-element array: [weeklyPct, monthlyPct, yearlyPct] (0–100 each)
     */
    public static double[] computeLiveRingPercentages(ConsistencyStats stats, double todayLivePct) {
        double weekly  = Math.min(100.0, (stats.getHistWeeklySum()  + todayLivePct) / 7.0);
        double monthly = Math.min(100.0, (stats.getHistMonthlySum() + todayLivePct) / 30.0);
        double yearly  = Math.min(100.0, (stats.getHistYearlySum()  + todayLivePct) / 365.0);
        return new double[]{weekly, monthly, yearly};
    }
}

