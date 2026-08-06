package com.gl.app.GroupService.repository;

import com.gl.app.GroupService.entity.GroupHabit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Spring Data repository for {@link GroupHabit} entities.
 */
public interface GroupHabitRepository extends JpaRepository<GroupHabit, Long> {

    /**
     * Returns all habits belonging to a given group.
     *
     * @param groupId the group ID
     * @return list of group habits
     */
    List<GroupHabit> findByGroupId(Long groupId);
}
