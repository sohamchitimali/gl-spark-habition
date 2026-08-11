package com.gl.app.GroupService.repository;

import com.gl.app.GroupService.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * Spring Data repository for {@link GroupMember} entities.
 */
public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {

    /**
     * Returns all members of a given group.
     *
     * @param groupId the group ID
     * @return list of group members
     */
    List<GroupMember> findByGroupId(Long groupId);

    /**
     * Checks whether a user is already a member of a group.
     *
     * @param groupId the group ID
     * @param userId  the user ID
     * @return true if membership exists
     */
    boolean existsByGroupIdAndUserId(Long groupId, Long userId);

    /**
     * Returns all group memberships for a given user.
     *
     * @param userId the user ID
     * @return list of group members
     */
    List<GroupMember> findByUserId(Long userId);

    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, Long userId);
}
