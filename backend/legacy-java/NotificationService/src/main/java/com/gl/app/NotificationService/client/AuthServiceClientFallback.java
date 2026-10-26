package com.gl.app.NotificationService.client;

import org.springframework.stereotype.Component;
import java.util.Collections;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class AuthServiceClientFallback implements AuthServiceClient {
    @Override
    public Map<String, Object> getUserMeta(String userId) {
        log.warn("AuthService is down! Returning empty meta for user {}", userId);
        return Collections.emptyMap();
    }

    @Override
    public void unsubscribeUser(String userId) {
        log.warn("AuthService is down! Could not unsubscribe user {}", userId);
    }
}
