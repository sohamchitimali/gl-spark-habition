package com.gl.app.NotificationService.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@FeignClient(name = "GROUP-SERVICE", fallback = GroupServiceClientFallback.class)
public interface GroupServiceClient {

    @GetMapping("/coins/groups/{groupId}/leaderboard")
    Map<String, Object> getLeaderboard(@PathVariable String groupId);

}
