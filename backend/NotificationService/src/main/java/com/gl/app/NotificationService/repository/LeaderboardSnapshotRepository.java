package com.gl.app.NotificationService.repository;

import com.gl.app.NotificationService.entity.LeaderboardSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeaderboardSnapshotRepository extends JpaRepository<LeaderboardSnapshot, String> {

    List<LeaderboardSnapshot> findByGroupId(String groupId);

    Optional<LeaderboardSnapshot> findByGroupIdAndUserId(String groupId, String userId);

    void deleteByGroupId(String groupId);
}

