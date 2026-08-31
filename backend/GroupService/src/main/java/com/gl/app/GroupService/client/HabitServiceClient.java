package com.gl.app.GroupService.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "HABIT-SERVICE", fallback = HabitServiceClientFallback.class)
public interface HabitServiceClient {

    @DeleteMapping("/api/habits/groups/{groupId}/users/{userId}")
    void removeUserFromGroup(@PathVariable("groupId") Long groupId, @PathVariable("userId") Long userId);
}
