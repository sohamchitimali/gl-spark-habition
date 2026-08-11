package com.gl.app.GroupService.controller;

import com.gl.app.GroupService.entity.GroupJoinRequest;
import com.gl.app.GroupService.entity.DirectMessage;
import com.gl.app.GroupService.service.JoinRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/groups/{groupId}/join-requests")
public class GroupJoinRequestController {

    @Autowired
    private JoinRequestService joinRequestService;

    @PostMapping
    public ResponseEntity<GroupJoinRequest> requestToJoin(
            @PathVariable Long groupId,
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody Map<String, String> request) {
        return new ResponseEntity<>(joinRequestService.requestToJoin(groupId, userId, request.get("initialMessage")), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<GroupJoinRequest>> getPendingRequests(
            @PathVariable Long groupId,
            @RequestHeader("X-User-Id") Long adminId) {
        return ResponseEntity.ok(joinRequestService.getPendingRequests(groupId, adminId));
    }

    @PostMapping("/{requestId}/approve")
    public ResponseEntity<Void> approveRequest(
            @PathVariable Long groupId,
            @PathVariable Long requestId,
            @RequestHeader("X-User-Id") Long adminId) {
        joinRequestService.approveRequest(groupId, requestId, adminId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{requestId}/reject")
    public ResponseEntity<Void> rejectRequest(
            @PathVariable Long groupId,
            @PathVariable Long requestId,
            @RequestHeader("X-User-Id") Long adminId) {
        joinRequestService.rejectRequest(groupId, requestId, adminId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{requestId}/messages")
    public ResponseEntity<DirectMessage> sendDM(
            @PathVariable Long groupId,
            @PathVariable Long requestId,
            @RequestHeader("X-User-Id") Long senderId,
            @RequestBody Map<String, String> request) {
        return new ResponseEntity<>(joinRequestService.sendDM(groupId, requestId, senderId, request.get("content")), HttpStatus.CREATED);
    }

    @GetMapping("/{requestId}/messages")
    public ResponseEntity<List<DirectMessage>> getMessages(
            @PathVariable Long groupId,
            @PathVariable Long requestId) {
        return ResponseEntity.ok(joinRequestService.getMessages(groupId, requestId));
    }
}
