package com.gl.app.AuthService;

import com.gl.app.AuthService.dto.AuthRequestDto;
import com.gl.app.AuthService.dto.AuthResponseDto;
import com.gl.app.AuthService.entity.User;
import com.gl.app.AuthService.entity.UserProfile;
import com.gl.app.AuthService.repository.UserRepository;
import com.gl.app.AuthService.security.JwtUtil;
import com.gl.app.AuthService.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link UserService} covering US-001 acceptance criteria.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private com.gl.app.AuthService.repository.UserProfileRepository userProfileRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private com.gl.app.AuthService.service.MeilisearchSyncService meilisearchSyncService;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("US-001: register should create user and return tokens when email is new")
    void register_withNewEmail_shouldCreateUserAndReturnTokens() {
        // Arrange
        AuthRequestDto request = new AuthRequestDto();
        request.setEmail("test@habition.com");
        request.setPassword("SecurePass123");
        request.setUsername("testuser");

        when(userRepository.findByEmail("test@habition.com")).thenReturn(Optional.empty());
        when(userRepository.findByUsername("testuser")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("SecurePass123")).thenReturn("hashed_password");
        when(jwtUtil.generateRefreshToken()).thenReturn("refresh-token-xyz");
        User saved = new User();
        saved.setId(1L);
        saved.setEmail("test@habition.com");
        saved.setUsername("testuser");
        saved.setPasswordHash("hashed_password");
        saved.setRefreshToken("refresh-token-xyz");
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(userProfileRepository.save(any(UserProfile.class))).thenReturn(new UserProfile());
        when(jwtUtil.generateAccessToken("1")).thenReturn("access-token-xyz");

        // Act
        AuthResponseDto response = userService.register(request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access-token-xyz");
        assertThat(response.getRefreshToken()).isEqualTo("refresh-token-xyz");
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    @DisplayName("US-001: register should throw when email already exists")
    void register_withExistingEmail_shouldThrowConflict() {
        // Arrange
        AuthRequestDto request = new AuthRequestDto();
        request.setEmail("existing@habition.com");
        request.setPassword("Password1");

        User user = new User();
        user.setId(1L);
        user.setEmail("existing@habition.com");
        user.setPasswordHash("hash");
        user.setRefreshToken("rt");
        when(userRepository.findByEmail("existing@habition.com"))
                .thenReturn(Optional.of(user));

        // Act & Assert
        assertThatThrownBy(() -> userService.register(request))
                .isInstanceOf(RuntimeException.class);
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("US-001: login should return tokens when credentials are valid")
    void login_withValidCredentials_shouldReturnTokens() {
        // Arrange
        AuthRequestDto request = new AuthRequestDto();
        request.setEmail("user@habition.com");
        request.setPassword("password");

        User user = new User();
        user.setId(2L);
        user.setEmail("user@habition.com");
        user.setPasswordHash("hashed");
        user.setRefreshToken("old-refresh");
        when(userRepository.findByEmail("user@habition.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password", "hashed")).thenReturn(true);
        when(jwtUtil.generateRefreshToken()).thenReturn("new-refresh-token");
        when(userRepository.save(any(User.class))).thenReturn(user);
        when(jwtUtil.generateAccessToken("2")).thenReturn("new-access-token");

        // Act
        AuthResponseDto response = userService.login(request);

        // Assert
        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    @DisplayName("US-001: login should throw when password is incorrect")
    void login_withWrongPassword_shouldThrowUnauthorized() {
        // Arrange
        AuthRequestDto request = new AuthRequestDto();
        request.setEmail("user@habition.com");
        request.setPassword("wrong-password");

        User user = new User();
        user.setId(2L);
        user.setEmail("user@habition.com");
        user.setPasswordHash("hashed");
        user.setRefreshToken("refresh");
        when(userRepository.findByEmail("user@habition.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "hashed")).thenReturn(false);

        // Act & Assert
        assertThatThrownBy(() -> userService.login(request))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Invalid credentials");
    }
}
