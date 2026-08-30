package com.gl.app.GroupService.repository;

import com.gl.app.GroupService.entity.GroupBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GroupBlockRepository extends JpaRepository<GroupBlock, Long> {
    boolean existsByGroupIdAndBlockedUserId(Long groupId, Long blockedUserId);
    List<GroupBlock> findByGroupId(Long groupId);
    void deleteByGroupIdAndBlockedUserId(Long groupId, Long blockedUserId);
    void deleteByGroupId(Long groupId);
}

