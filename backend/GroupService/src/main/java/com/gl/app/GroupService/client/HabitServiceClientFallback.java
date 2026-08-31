package com.gl.app.GroupService.client;

import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class HabitServiceClientFallback implements HabitServiceClient {

    @Override
    public void removeUserFromGroup(Long groupId, Long userId) {
        log.warn("HabitService is down! Failed to remove user {} from group {}. Silent fallback.", userId, groupId);
    }
}
