package com.gl.app.AuthService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String email;
    
    @Column(nullable = false)
    private String passwordHash;
    
    private String refreshToken;

    // Core fields
    @Column(unique = true)
    private String username;

    @Column(name = "email_verified", nullable = false)
    private Boolean emailVerified = false;

    @Column(name = "email_bounced", nullable = false)
    private Boolean emailBounced = false;

    @Column(name = "email_notifications_enabled", nullable = false)
    private Boolean emailNotificationsEnabled = true;

    @Column(name = "notification_window_start", nullable = false)
    private String notificationWindowStart = "09:00";

    @Column(name = "notification_window_end", nullable = false)
    private String notificationWindowEnd = "21:00";

    @Column(name = "notification_frequency", nullable = false)
    private Integer notificationFrequency = 3;
    
    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    private UserProfile profile;
}
