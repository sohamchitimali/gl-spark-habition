package com.gl.app.HabitService.client;

import com.gl.app.HabitService.dto.UserProfileDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "auth-service", fallback = AuthServiceClientFallback.class)
public interface AuthServiceClient {

    @GetMapping("/api/users/{userId}/profile")
    UserProfileDto getUserProfile(@PathVariable Long userId);
}
