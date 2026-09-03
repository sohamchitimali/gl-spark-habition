package com.gl.app.AuthService.repository;

import com.gl.app.AuthService.entity.OtpRateLimitEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface OtpRateLimitRepository extends JpaRepository<OtpRateLimitEntity, String> {

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO otp_rate_limit (email, last_sent_at) VALUES (:email, NOW()) " +
                   "ON CONFLICT (email) DO UPDATE SET last_sent_at = NOW() " +
                   "WHERE otp_rate_limit.last_sent_at < NOW() - INTERVAL '60 seconds'", 
           nativeQuery = true)
    int tryAcquireToken(@Param("email") String email);
}
