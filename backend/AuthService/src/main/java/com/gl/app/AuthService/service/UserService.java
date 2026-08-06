package com.gl.app.AuthService.service;

import com.gl.app.AuthService.dto.AuthRequestDto;
import com.gl.app.AuthService.dto.AuthResponseDto;
import com.gl.app.AuthService.entity.User;
import com.gl.app.AuthService.repository.UserRepository;
import com.gl.app.AuthService.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import com.gl.app.AuthService.dto.ProfileDto;
import com.gl.app.AuthService.dto.UserProfileDto;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    public AuthResponseDto register(AuthRequestDto request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        
        String refreshToken = jwtUtil.generateRefreshToken();
        user.setRefreshToken(refreshToken);
        
        User savedUser = userRepository.save(user);

        String accessToken = jwtUtil.generateAccessToken(String.valueOf(savedUser.getId()));
        return new AuthResponseDto(accessToken, refreshToken, savedUser.getId());
    }

    public AuthResponseDto login(AuthRequestDto request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }

        String refreshToken = jwtUtil.generateRefreshToken();
        user.setRefreshToken(refreshToken);
        User savedUser = userRepository.save(user);

        String accessToken = jwtUtil.generateAccessToken(String.valueOf(savedUser.getId()));
        return new AuthResponseDto(accessToken, refreshToken, savedUser.getId());
    }

    public AuthResponseDto refresh(String refreshToken) {
        // Simple implementation: ideally you'd verify the refresh token hasn't expired.
        // For now, if we find a user with this refresh token, issue a new access token.
        // And optionally a new refresh token.
        
        // Let's just find by refresh token - wait, UserRepository needs a findByRefreshToken method.
        // We will add it shortly. Let's assume it exists.
        User user = userRepository.findByRefreshToken(refreshToken)
                .orElseThrow(() -> new RuntimeException("Invalid refresh token"));
                
        String newAccessToken = jwtUtil.generateAccessToken(String.valueOf(user.getId()));
        String newRefreshToken = jwtUtil.generateRefreshToken();
        
        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);
        
        return new AuthResponseDto(newAccessToken, newRefreshToken, user.getId());
    }

    public List<UserProfileDto> getUsersByIds(List<Long> ids) {
        return userRepository.findAllById(ids).stream()
                .map(u -> new UserProfileDto(u.getId(), u.getEmail(), u.getName(), u.getPreferredColor(), u.getLocation(), u.getGenreOfInterest(), u.getBio()))
                .collect(Collectors.toList());
    }

    public ProfileDto getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return new ProfileDto(user.getName(), user.getPreferredColor(), user.getLocation(), user.getGenreOfInterest(), user.getBio());
    }

    public ProfileDto updateProfile(Long userId, ProfileDto request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setName(request.getName());
        user.setPreferredColor(request.getPreferredColor());
        user.setLocation(request.getLocation());
        user.setGenreOfInterest(request.getGenreOfInterest());
        user.setBio(request.getBio());
        
        User savedUser = userRepository.save(user);
        return new ProfileDto(savedUser.getName(), savedUser.getPreferredColor(), savedUser.getLocation(), savedUser.getGenreOfInterest(), savedUser.getBio());
    }
}
