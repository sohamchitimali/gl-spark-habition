package com.gl.app.NotificationService.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;

@FeignClient(name = "HABIT-SERVICE", fallback = HabitServiceClientFallback.class)
public interface HabitServiceClient {

    @GetMapping("/habits/users/{userId}/completion-status-today")
    List<Map<String, Object>> getCompletionStatusToday(@PathVariable String userId);

    @GetMapping("/habits/consistency/personal")
    Map<String, Object> getPersonalConsistency(@RequestParam String userId);

    @GetMapping("/habits/users/{userId}/daily-completion")
    Map<String, Object> getPersonalDailyCompletion(@PathVariable String userId, @RequestParam String date);

    @GetMapping("/habits/users/{memberId}/group/{groupId}/daily-completion")
    Map<String, Object> getGroupMemberDailyCompletion(@PathVariable String memberId, @PathVariable String groupId, @RequestParam String date);

    @GetMapping("/habits/groups/{groupId}/daily-completion")
    Map<String, Object> getGroupDailyCompletion(@PathVariable String groupId, @RequestParam String date);

}
