package com.gl.app.AuthService.repository;

import com.gl.app.AuthService.entity.UsernameReservation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsernameReservationRepository extends JpaRepository<UsernameReservation, String> {
}
