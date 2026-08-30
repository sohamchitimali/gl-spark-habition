package com.gl.app.AuthService.repository;

import com.gl.app.AuthService.entity.UsernameReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UsernameReservationRepository extends JpaRepository<UsernameReservation, String> {
}
