package com.gl.app.GroupService.repository;

import com.gl.app.GroupService.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@link Group} entities.
 */
public interface GroupRepository extends JpaRepository<Group, Long> {

    /**
     * Finds a group by its unique invite code.
     *
     * @param inviteCode the invite code string
     * @return an Optional containing the group, or empty if not found
     */
    Optional<Group> findByInviteCode(String inviteCode);
}
