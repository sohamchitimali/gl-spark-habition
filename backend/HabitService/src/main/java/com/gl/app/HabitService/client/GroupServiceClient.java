package com.gl.app.HabitService.client;

import com.gl.app.HabitService.dto.GroupResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;

@FeignClient(name = "GROUP-SERVICE", contextId = "groupServiceClient")
public interface GroupServiceClient {

    @GetMapping("/groups/my-groups")
    List<GroupResponse> getUserGroups(@RequestHeader("X-User-Id") Long userId);

    @GetMapping("/groups/{id}")
    GroupResponse getGroup(@org.springframework.web.bind.annotation.PathVariable("id") Long id);
}
