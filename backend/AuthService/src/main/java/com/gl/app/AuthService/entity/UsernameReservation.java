package com.gl.app.AuthService.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "username_reservation")
@Data
@NoArgsConstructor
public class UsernameReservation {

    @Id
    private String username;

    @Column(nullable = false)
    private String sessionId;

    @Column(nullable = false)
    private LocalDateTime expiresAt;
}
