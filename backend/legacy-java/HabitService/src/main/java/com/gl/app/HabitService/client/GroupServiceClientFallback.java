package com.gl.app.HabitService.client;

import com.gl.app.HabitService.dto.GroupResponse;
import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class GroupServiceClientFallback implements GroupServiceClient {
    @Override
    public List<GroupResponse> getUserGroups(Long userId) {
        log.warn("GroupService is down! Returning empty list for getUserGroups({})", userId);
        return Collections.emptyList();
    }

    @Override
    public GroupResponse getGroup(Long id) {
        log.warn("GroupService is down! Returning null for getGroup({})", id);
        return null;
    }
}
