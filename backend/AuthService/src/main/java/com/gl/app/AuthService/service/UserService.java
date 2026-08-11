package com.gl.app.AuthService.service;

import com.gl.app.AuthService.dto.AuthRequestDto;
import com.gl.app.AuthService.dto.AuthResponseDto;
import com.gl.app.AuthService.entity.User;
import com.gl.app.AuthService.entity.UserProfile;
import com.gl.app.AuthService.repository.UserRepository;
import com.gl.app.AuthService.repository.UserProfileRepository;
import com.gl.app.AuthService.repository.TagRepository;
import com.gl.app.AuthService.entity.Tag;
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
    private UserProfileRepository userProfileRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private MeilisearchSyncService meilisearchSyncService;

    public AuthResponseDto register(AuthRequestDto request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Email already exists");
        }

        if (request.getUsername() == null || request.getUsername().length() < 5) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Username must be at least 5 characters");
        }

        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Username already exists");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        
        String refreshToken = jwtUtil.generateRefreshToken();
        user.setRefreshToken(refreshToken);
        
        User savedUser = userRepository.save(user);

        UserProfile profile = new UserProfile();
        profile.setUser(savedUser);
        profile.setName(request.getEmail().split("@")[0]); // Default name
        userProfileRepository.save(profile);

        String accessToken = jwtUtil.generateAccessToken(String.valueOf(savedUser.getId()));
        meilisearchSyncService.syncUser(savedUser);
        return new AuthResponseDto(accessToken, refreshToken, savedUser.getId());
    }

    public boolean isUsernameAvailable(String username) {
        return userRepository.findByUsername(username).isEmpty();
    }

    public AuthResponseDto login(AuthRequestDto request) {
        String identifier = request.getEmail(); // frontend might send username in email field
        
        Optional<User> userOpt;
        if (identifier.contains("@")) {
            userOpt = userRepository.findByEmail(identifier);
        } else {
            userOpt = userRepository.findByUsername(identifier);
        }
        
        User user = userOpt.orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        String refreshToken = jwtUtil.generateRefreshToken();
        user.setRefreshToken(refreshToken);
        User savedUser = userRepository.save(user);

        String accessToken = jwtUtil.generateAccessToken(String.valueOf(savedUser.getId()));
        return new AuthResponseDto(accessToken, refreshToken, savedUser.getId());
    }

    public AuthResponseDto refresh(String refreshToken) {
        User user = userRepository.findByRefreshToken(refreshToken)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Invalid refresh token"));
                
        String newAccessToken = jwtUtil.generateAccessToken(String.valueOf(user.getId()));
        String newRefreshToken = jwtUtil.generateRefreshToken();
        
        user.setRefreshToken(newRefreshToken);
        userRepository.save(user);
        
        return new AuthResponseDto(newAccessToken, newRefreshToken, user.getId());
    }

    public List<UserProfileDto> getUsersByIds(List<Long> ids) {
        return userRepository.findAllById(ids).stream()
                .map(u -> {
                    UserProfile profile = userProfileRepository.findByUserId(u.getId()).orElse(new UserProfile());
                    return new UserProfileDto(u.getId(), u.getEmail(), u.getUsername(), profile.getName(), profile.getPreferredColor(), profile.getAddressDisplay(), profile.getBio(), profile.getBio());
                })
                .collect(Collectors.toList());
    }

    public com.gl.app.AuthService.dto.UserProfileDto getUserByUsername(String username) {
        User u = userRepository.findByUsername(username)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "User not found"));
        UserProfile profile = userProfileRepository.findByUserId(u.getId()).orElse(new UserProfile());
        return new com.gl.app.AuthService.dto.UserProfileDto(u.getId(), u.getEmail(), u.getUsername(), profile.getName(), profile.getPreferredColor(), profile.getAddressDisplay(), profile.getBio(), profile.getBio());
    }

    public ProfileDto getProfile(Long userId) {
        UserProfile profile = userProfileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "User not found"));
                    UserProfile newProfile = new UserProfile();
                    newProfile.setUser(user);
                    newProfile.setName(user.getEmail().split("@")[0]);
                    newProfile.setPreferredColor("#534AB7");
                    return userProfileRepository.save(newProfile);
                });
        ProfileDto dto = new ProfileDto();
        dto.setUsername(profile.getUser().getUsername());
        dto.setName(profile.getName());
        dto.setPreferredColor(profile.getPreferredColor());
        dto.setLocation(profile.getAddressDisplay());
        dto.setLatitude(profile.getLatitude());
        dto.setLongitude(profile.getLongitude());
        dto.setTimeZone(profile.getTimeZone());

        dto.setLocationVisibility(profile.getLocationVisibility() != null ? profile.getLocationVisibility().name() : null);
        dto.setBio(profile.getBio());
        if (profile.getTags() != null) {
            dto.setTags(profile.getTags().stream().map(t -> t.getName()).collect(Collectors.toList()));
        }
        return dto;
    }

    public ProfileDto updateProfile(Long userId, ProfileDto request) {
        UserProfile profile = userProfileRepository.findByUserId(userId)
                .orElseGet(() -> {
                    User user = userRepository.findById(userId)
                            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "User not found"));
                    UserProfile newProfile = new UserProfile();
                    newProfile.setUser(user);
                    return newProfile;
                });
        User user = profile.getUser();
        if (request.getUsername() != null && !request.getUsername().equals(user.getUsername())) {
            if (userRepository.findByUsername(request.getUsername()).isPresent()) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT, "Username already exists");
            }
            user.setUsername(request.getUsername());
            userRepository.save(user);
        }

        profile.setName(request.getName());
        profile.setPreferredColor(request.getPreferredColor());
        profile.setAddressDisplay(request.getLocation() != null ? request.getLocation() : request.getAddressDisplay());
        profile.setLatitude(request.getLatitude());
        profile.setLongitude(request.getLongitude());
        profile.setBio(request.getBio());
        
        if (request.getLocationVisibility() != null) {
            profile.setLocationVisibility(com.gl.app.AuthService.entity.Visibility.valueOf(request.getLocationVisibility()));
        }
        
        if (request.getTags() != null) {
            List<Tag> profileTags = request.getTags().stream().map(tagName -> {
                return tagRepository.findByName(tagName.trim().toLowerCase())
                        .orElseGet(() -> {
                            Tag newTag = new Tag();
                            newTag.setName(tagName.trim().toLowerCase());
                            return tagRepository.save(newTag);
                        });
            }).collect(Collectors.toList());
            profile.setTags(profileTags);
        }
        
        UserProfile savedProfile = userProfileRepository.save(profile);
        ProfileDto dto = new ProfileDto();
        dto.setName(savedProfile.getName());
        dto.setPreferredColor(savedProfile.getPreferredColor());
        dto.setLocation(savedProfile.getAddressDisplay());
        dto.setLatitude(savedProfile.getLatitude());
        dto.setLongitude(savedProfile.getLongitude());
        dto.setTimeZone(savedProfile.getTimeZone());

        dto.setLocationVisibility(savedProfile.getLocationVisibility() != null ? savedProfile.getLocationVisibility().name() : null);
        dto.setBio(savedProfile.getBio());
        if (savedProfile.getTags() != null) {
            dto.setTags(savedProfile.getTags().stream().map(t -> t.getName()).collect(Collectors.toList()));
        }
        
        // Sync to Meilisearch
        meilisearchSyncService.syncUser(user);
        
        return dto;
    }
}
