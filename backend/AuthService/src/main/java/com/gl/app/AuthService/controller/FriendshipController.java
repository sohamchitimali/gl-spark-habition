package com.gl.app.AuthService.controller;

import com.gl.app.AuthService.dto.FriendshipDto;
import com.gl.app.AuthService.service.FriendshipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/auth/friends")
public class FriendshipController {

    @Autowired
    private FriendshipService friendshipService;

    @PostMapping("/request/{username}")
    public ResponseEntity<FriendshipDto> sendFriendRequest(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable String username) {
        return ResponseEntity.ok(friendshipService.sendFriendRequest(userId, username));
    }

    @PutMapping("/accept/{friendshipId}")
    public ResponseEntity<FriendshipDto> acceptRequest(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long friendshipId) {
        return ResponseEntity.ok(friendshipService.acceptRequest(userId, friendshipId));
    }

    @DeleteMapping("/{friendshipId}")
    public ResponseEntity<Void> removeOrRejectFriend(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long friendshipId) {
        friendshipService.removeOrRejectFriend(userId, friendshipId);
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<List<FriendshipDto>> getUserFriendships(
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(friendshipService.getUserFriendships(userId));
    }
}
