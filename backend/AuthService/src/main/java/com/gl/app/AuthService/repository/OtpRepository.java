package com.gl.app.AuthService.repository;

import com.gl.app.AuthService.entity.OtpEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

import java.util.Optional;

@Repository
public interface OtpRepository extends JpaRepository<OtpEntity, Long> {
    
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(value = "SELECT o FROM OtpEntity o WHERE o.email = :email AND o.purpose = :purpose AND o.status = 'PENDING' ORDER BY o.createdAt DESC LIMIT 1")
    Optional<OtpEntity> findLatestPendingByEmailAndPurposeForUpdate(@Param("email") String email, @Param("purpose") String purpose);
}
