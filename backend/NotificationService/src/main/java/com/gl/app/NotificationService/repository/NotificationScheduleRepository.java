package com.gl.app.NotificationService.repository;

import com.gl.app.NotificationService.entity.NotificationSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface NotificationScheduleRepository extends JpaRepository<NotificationSchedule, String> {

    Optional<NotificationSchedule> findByUserId(String userId);

    boolean existsByUserId(String userId);
}

