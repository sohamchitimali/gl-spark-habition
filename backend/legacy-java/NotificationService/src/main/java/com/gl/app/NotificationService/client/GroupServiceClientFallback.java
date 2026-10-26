package com.gl.app.NotificationService.client;

import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class GroupServiceClientFallback implements GroupServiceClient {
    @Override
    public Map<String, Object> getLeaderboard(String groupId) {
        log.warn("GroupService is down! Returning empty leaderboard for {}", groupId);
        return Collections.emptyMap();
    }
}
