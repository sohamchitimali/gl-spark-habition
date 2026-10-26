package com.gl.app.NotificationService.client;

import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class HabitServiceClientFallback implements HabitServiceClient {

    @Override
    public List<Map<String, Object>> getCompletionStatusToday(String userId) {
        log.warn("HabitService is down! Returning empty list for completion status {}", userId);
        return Collections.emptyList();
    }

    @Override
    public Map<String, Object> getPersonalConsistency(String userId) {
        log.warn("HabitService is down! Returning empty map for personal consistency {}", userId);
        return Collections.emptyMap();
    }

    @Override
    public Map<String, Object> getPersonalDailyCompletion(String userId, String date) {
        log.warn("HabitService is down! Returning empty map for daily completion {}", userId);
        return Collections.emptyMap();
    }

    @Override
    public Map<String, Object> getGroupMemberDailyCompletion(String memberId, String groupId, String date) {
        log.warn("HabitService is down! Returning empty map for daily completion {} {}", memberId, groupId);
        return Collections.emptyMap();
    }

    @Override
    public Map<String, Object> getGroupDailyCompletion(String groupId, String date) {
        log.warn("HabitService is down! Returning empty map for group daily completion {}", groupId);
        return Collections.emptyMap();
    }
}
