package com.gl.app.NotificationService.repository;

import com.gl.app.NotificationService.entity.LeaderboardSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeaderboardSnapshotRepository extends JpaRepository<LeaderboardSnapshot, String> {

    List<LeaderboardSnapshot> findByGroupId(String groupId);

    Optional<LeaderboardSnapshot> findByGroupIdAndUserId(String groupId, String userId);

    void deleteByGroupId(String groupId);

    @Query("SELECT COUNT(ls) + 1 FROM LeaderboardSnapshot ls WHERE ls.groupId = :groupId AND ls.score > :liveScore")
    Integer calculateLiveRank(@Param("groupId") String groupId, @Param("liveScore") int liveScore);
}

