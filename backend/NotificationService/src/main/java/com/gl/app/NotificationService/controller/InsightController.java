package com.gl.app.NotificationService.controller;

import com.gl.app.NotificationService.dto.GroupInsightDTO;
import com.gl.app.NotificationService.dto.UserInsightDTO;
import com.gl.app.NotificationService.service.SignalEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/insights")
@RequiredArgsConstructor
public class InsightController {

    private final SignalEngineService signalEngineService;

    @GetMapping("/groups/{id}")
    public ResponseEntity<GroupInsightDTO> getGroupInsights(@PathVariable("id") String groupId) {
        // In a real scenario, date would likely be the current date based on group timezone
        LocalDate date = LocalDate.now();
        GroupInsightDTO insights = signalEngineService.computeGroupInsights(groupId, date);
        return ResponseEntity.ok(insights);
    }

    @GetMapping("/users/me")
    public ResponseEntity<UserInsightDTO> getUserInsights(@RequestHeader("X-User-Id") String userId) {
        // In a real scenario, date would likely be the current date based on user timezone
        // And userId would come from the security context or gateway header
        LocalDate date = LocalDate.now();
        UserInsightDTO insights = signalEngineService.computeUserInsights(userId, date);
        return ResponseEntity.ok(insights);
    }
}

