package com.gl.app.GroupService.controller;

import com.gl.app.GroupService.dto.*;
import com.gl.app.GroupService.service.GroupService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller exposing group management endpoints.
 * JWT validation is handled at the API Gateway layer;
 * this controller reads user identity from the {@code X-User-Id} header.
 */
@RestController
@RequestMapping("/groups")
@Slf4j
public class GroupController {

    @Autowired
    private GroupService groupService;

    /**
     * Creates a new habit group.
     * Relates to US-002.
     *
     * @param request the group creation details
     * @param userId  the authenticated user's ID injected by the gateway
     * @return 201 Created with the new group details
     */
    @PostMapping
    public ResponseEntity<GroupResponse> createGroup(
            @RequestBody @Valid CreateGroupRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return new ResponseEntity<>(groupService.createGroup(request, userId), HttpStatus.CREATED);
    }

    /**
     * Joins an existing group using an invite code.
     * Relates to US-003.
     *
     * @param request  the join request containing the invite code
     * @param userId   the authenticated user's ID injected by the gateway
     * @return 200 OK with the joined group details
     */
    @PostMapping("/join")
    public ResponseEntity<GroupResponse> joinGroup(
            @RequestBody @Valid JoinGroupRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(groupService.joinGroup(request, userId));
    }

    /**
     * Adds a habit/task to a specific group.
     * Relates to US-002.
     *
     * @param id      the group ID
     * @param request the habit details
     * @return 201 Created with the new habit
     */
    @PostMapping("/{id}/habits")
    public ResponseEntity<GroupHabitResponse> addHabit(
            @PathVariable Long id,
            @RequestBody @Valid AddHabitRequest request) {
        return new ResponseEntity<>(groupService.addHabit(id, request), HttpStatus.CREATED);
    }

    /**
     * Deletes a habit/task from a specific group.
     *
     * @param id      the group ID
     * @param habitId the habit ID
     * @param userId  the user ID (must be owner)
     * @return 204 No Content
     */
    @DeleteMapping("/{id}/habits/{habitId}")
    public ResponseEntity<Void> deleteHabit(
            @PathVariable Long id,
            @PathVariable Long habitId,
            @RequestHeader("X-User-Id") Long userId) {
        groupService.deleteHabit(id, habitId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Retrieves full group details including members and habits.
     * Relates to US-003.
     *
     * @param id the group ID
     * @return 200 OK with group details
     */
    @GetMapping("/{id}")
    public ResponseEntity<GroupResponse> getGroup(@PathVariable Long id) {
        return ResponseEntity.ok(groupService.getGroup(id));
    }
}
