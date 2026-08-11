package com.gl.app.AuthService.controller;

import com.gl.app.AuthService.dto.AuthRequestDto;
import com.gl.app.AuthService.dto.AuthResponseDto;
import com.gl.app.AuthService.dto.RefreshRequestDto;
import com.gl.app.AuthService.dto.ProfileDto;
import com.gl.app.AuthService.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private com.gl.app.AuthService.service.UserSearchService userSearchService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponseDto> register(@RequestBody AuthRequestDto request) {
        return ResponseEntity.ok(userService.register(request));
    }

    @GetMapping("/check-username")
    public ResponseEntity<Boolean> checkUsername(@RequestParam String username) {
        return ResponseEntity.ok(userService.isUsernameAvailable(username));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponseDto> login(@RequestBody AuthRequestDto request) {
        return ResponseEntity.ok(userService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponseDto> refresh(@RequestBody RefreshRequestDto request) {
        return ResponseEntity.ok(userService.refresh(request.getRefreshToken()));
    }

    @GetMapping("/users")
    public ResponseEntity<List<com.gl.app.AuthService.dto.UserProfileDto>> getUsersByIds(@RequestParam List<Long> ids) {
        return ResponseEntity.ok(userService.getUsersByIds(ids));
    }

    @GetMapping("/users/by-username")
    public ResponseEntity<com.gl.app.AuthService.dto.UserProfileDto> getUserByUsername(@RequestParam String username) {
        return ResponseEntity.ok(userService.getUserByUsername(username));
    }

    @GetMapping("/profile")
    public ResponseEntity<ProfileDto> getProfile(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(userService.getProfile(userId));
    }

    @PutMapping("/profile")
    public ResponseEntity<ProfileDto> updateProfile(@RequestHeader("X-User-Id") Long userId, @RequestBody ProfileDto request) {
        return ResponseEntity.ok(userService.updateProfile(userId, request));
    }

    @GetMapping("/search")
    public ResponseEntity<List<ProfileDto>> searchUsers(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam String query) {
        // Fetch current user's profile to get their tags and location
        ProfileDto currentUserProfile = userService.getProfile(userId);
        List<String> tags = currentUserProfile.getTags() != null ? currentUserProfile.getTags() : List.of();
        Double lat = currentUserProfile.getLatitude();
        Double lng = currentUserProfile.getLongitude();

        List<ProfileDto> results = userSearchService.searchUsers(query, tags, lat, lng);
        if (currentUserProfile.getUsername() != null) {
            results.removeIf(p -> currentUserProfile.getUsername().equals(p.getUsername()));
        }
        return ResponseEntity.ok(results);
    }
}
