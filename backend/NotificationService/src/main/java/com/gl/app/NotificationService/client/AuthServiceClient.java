package com.gl.app.NotificationService.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

@FeignClient(name = "auth-service", fallback = AuthServiceClientFallback.class)
public interface AuthServiceClient {

    @GetMapping("/auth/users/{userId}/meta")
    Map<String, Object> getUserMeta(@PathVariable("userId") String userId);

    @org.springframework.web.bind.annotation.PostMapping("/auth/users/{userId}/unsubscribe")
    void unsubscribeUser(@PathVariable("userId") String userId);

}
