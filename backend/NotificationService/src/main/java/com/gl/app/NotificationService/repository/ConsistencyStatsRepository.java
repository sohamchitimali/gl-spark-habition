package com.gl.app.NotificationService.repository;

import com.gl.app.NotificationService.entity.ConsistencyStats;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ConsistencyStatsRepository extends JpaRepository<ConsistencyStats, String> {

    Optional<ConsistencyStats> findByEntityTypeAndEntityIdAndScope(String entityType, String entityId, String scope);

    Optional<ConsistencyStats> findByEntityTypeAndEntityIdAndScopeAndMemberId(
            String entityType, String entityId, String scope, String memberId);
}

