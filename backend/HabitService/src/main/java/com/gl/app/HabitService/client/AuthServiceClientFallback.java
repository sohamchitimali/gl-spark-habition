package com.gl.app.HabitService.client;

import com.gl.app.HabitService.dto.UserProfileDto;
import org.springframework.stereotype.Component;

@Component
public class AuthServiceClientFallback implements AuthServiceClient {
    @Override
    public UserProfileDto getUserProfile(Long userId) {
        // Return a dummy profile or null depending on requirements
        return new UserProfileDto();
    }
}
