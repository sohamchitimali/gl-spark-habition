package com.gl.app.NotificationService.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Computes notification slot times for a user's window using IANA timezone handling.
 *
 * Rules (per v5 plan):
 * - Slot formula: interval = windowDuration / N, last slot lands one interval before window end.
 * - DST gap: shifts forward to the next valid instant automatically via ZonedDateTime.
 * - DST duplicate: fires once at the EARLIER candidate instant.
 * - Window bounded to 00:00–23:00 local time (enforced by the settings validator, not here).
 * - Downtime/staleness recovery: if nextSlotAt is in the past, discard-and-recompute-forward.
 */
@Service
@Slf4j
public class SlotMathEngine {

    /**
     * Given a user's schedule parameters, computes the list of wall-clock slot times
     * for today in the user's local timezone.
     *
     * @param ianaTimezone  User's IANA timezone string (e.g., "Asia/Kolkata")
     * @param windowStart   Window start time string (e.g., "18:00")
     * @param windowEnd     Window end time string (e.g., "22:00")
     * @param frequency     Number of slots per day (N)
     * @return List of ZonedDateTime slot instants for today, in order
     */
    public List<ZonedDateTime> computeSlotsForToday(String ianaTimezone, String windowStart,
                                                     String windowEnd, int frequency) {
        ZoneId zone = ZoneId.of(ianaTimezone);
        ZonedDateTime now = ZonedDateTime.now(zone);

        LocalTime startTime = LocalTime.parse(windowStart);
        LocalTime endTime = LocalTime.parse(windowEnd);

        ZonedDateTime windowStartZdt = now.toLocalDate().atTime(startTime).atZone(zone);
        ZonedDateTime windowEndZdt = now.toLocalDate().atTime(endTime).atZone(zone);

        Duration windowDuration = Duration.between(windowStartZdt, windowEndZdt);
        Duration interval = windowDuration.dividedBy(frequency);

        List<ZonedDateTime> slots = new ArrayList<>();
        for (int i = 0; i < frequency; i++) {
            // Last slot lands one interval before window end
            ZonedDateTime slot = windowStartZdt.plus(interval.multipliedBy(i));
            // ZonedDateTime handles DST gaps automatically (shifts to next valid instant)
            slots.add(slot);
        }

        return slots;
    }

    /**
     * Computes the NEXT slot time after now, performing discard-and-recompute-forward
     * if the server was down and slots were missed. NEVER generates a past-time slot.
     *
     * @param ianaTimezone IANA timezone string
     * @param windowStart  Window start time string
     * @param windowEnd    Window end time string
     * @param frequency    Number of slots per day
     * @param cycleIndex   The current cycle index (0-based)
     * @return The next ZonedDateTime to schedule, or null if no more slots today
     */
    public ZonedDateTime computeNextSlot(String ianaTimezone, String windowStart,
                                          String windowEnd, int frequency, int cycleIndex) {
        ZoneId zone = ZoneId.of(ianaTimezone);
        ZonedDateTime now = ZonedDateTime.now(zone);

        List<ZonedDateTime> allSlots = computeSlotsForToday(ianaTimezone, windowStart, windowEnd, frequency);

        // If the requested cycleIndex slot is in the past, discard it and move forward
        for (int i = cycleIndex; i < allSlots.size(); i++) {
            ZonedDateTime candidate = allSlots.get(i);
            if (candidate.isAfter(now)) {
                return candidate;
            }
            log.debug("Discarding past slot {} (downtime recovery)", candidate);
        }

        // All slots for today have passed — return null (caller schedules for tomorrow's first slot)
        return null;
    }

    /**
     * Computes the first slot for tomorrow's window.
     *
     * @param ianaTimezone IANA timezone string
     * @param windowStart  Window start time string
     * @param windowEnd    Window end time string
     * @param frequency    Number of slots per day
     * @return The first slot for tomorrow
     */
    public ZonedDateTime computeFirstSlotTomorrow(String ianaTimezone, String windowStart,
                                                   String windowEnd, int frequency) {
        ZoneId zone = ZoneId.of(ianaTimezone);
        ZonedDateTime now = ZonedDateTime.now(zone);

        LocalTime startTime = LocalTime.parse(windowStart);
        LocalTime endTime = LocalTime.parse(windowEnd);

        ZonedDateTime tomorrowWindowStart = now.toLocalDate().plusDays(1).atTime(startTime).atZone(zone);
        ZonedDateTime tomorrowWindowEnd = now.toLocalDate().plusDays(1).atTime(endTime).atZone(zone);

        Duration windowDuration = Duration.between(tomorrowWindowStart, tomorrowWindowEnd);
        Duration interval = windowDuration.dividedBy(frequency);

        return tomorrowWindowStart.plus(interval.multipliedBy(0));
    }

    /**
     * Validates that a window configuration obeys product constraints:
     * - Start must be before end
     * - Window must be at least 6 hours
     * - End must be <= 23:00
     * - Frequency must satisfy [2, MIN(6, floor(windowMinutes / 60))]
     *
     * @return null if valid, or an error message string if invalid
     */
    public String validateWindow(String windowStart, String windowEnd, int frequency) {
        LocalTime start = LocalTime.parse(windowStart);
        LocalTime end = LocalTime.parse(windowEnd);

        if (!start.isBefore(end)) {
            return "Window start must be before window end";
        }

        long windowMinutes = Duration.between(start, end).toMinutes();
        if (windowMinutes < 360) {
            return "Notification window must be at least 6 hours wide";
        }

        if (end.isAfter(LocalTime.of(23, 0))) {
            return "Notification window must end by 23:00 local time";
        }

        int maxFrequency = Math.min(6, (int) (windowMinutes / 60));
        if (frequency < 2 || frequency > maxFrequency) {
            return "Frequency must be between 2 and " + maxFrequency + " for this window";
        }

        return null;
    }
}

