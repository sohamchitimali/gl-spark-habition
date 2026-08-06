package com.gl.app.GroupService.service;

import com.gl.app.GroupService.dto.*;
import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.entity.GroupHabit;
import com.gl.app.GroupService.entity.GroupMember;
import com.gl.app.GroupService.repository.GroupHabitRepository;
import com.gl.app.GroupService.repository.GroupMemberRepository;
import com.gl.app.GroupService.repository.GroupRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Business logic service for group management operations including
 * creation, joining via invite code, habit management, and competition setup.
 */
@Service
@Slf4j
public class GroupService {

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private GroupHabitRepository groupHabitRepository;

    /**
     * Creates a new habit group owned by the given user.
     *
     * @param request the group creation request containing the name
     * @param userId  the ID of the creating user (from gateway header)
     * @return the created group as a {@link GroupResponse}
     */
    public GroupResponse createGroup(CreateGroupRequest request, Long userId) {
        log.info("Creating group '{}' for userId={}", request.getName(), userId);
        Group group = new Group();
        group.setName(request.getName());
        group.setInviteCode(generateInviteCode());
        group.setOwnerId(userId);
        group.setCompetitionActive(false);
        group = groupRepository.save(group);

        // Automatically add owner as first member
        GroupMember member = new GroupMember(null, group.getId(), userId, LocalDateTime.now());
        groupMemberRepository.save(member);

        log.info("Group created with id={} inviteCode={}", group.getId(), group.getInviteCode());
        return toResponse(group);
    }

    /**
     * Adds a user to a group using the group's invite code.
     *
     * @param request the join request containing the invite code
     * @param userId  the ID of the user joining (from gateway header)
     * @return the joined group as a {@link GroupResponse}
     * @throws ResponseStatusException 404 if invite code is invalid, 409 if already a member
     */
    public GroupResponse joinGroup(JoinGroupRequest request, Long userId) {
        log.info("User {} attempting to join group with inviteCode={}", userId, request.getInviteCode());
        Group group = groupRepository.findByInviteCode(request.getInviteCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid invite code"));

        if (groupMemberRepository.existsByGroupIdAndUserId(group.getId(), userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already a member of this group");
        }

        GroupMember member = new GroupMember(null, group.getId(), userId, LocalDateTime.now());
        groupMemberRepository.save(member);

        log.info("User {} joined group {}", userId, group.getId());
        return toResponse(group);
    }

    /**
     * Adds a habit/task definition to a group.
     *
     * @param groupId the ID of the group
     * @param request the habit details
     * @return the created habit as a {@link GroupHabitResponse}
     * @throws ResponseStatusException 404 if group not found
     */
    public GroupHabitResponse addHabit(Long groupId, AddHabitRequest request) {
        log.info("Adding habit '{}' to group {}", request.getTitle(), groupId);
        groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        GroupHabit habit = new GroupHabit(null, groupId, request.getTitle(), request.getDescription());
        habit = groupHabitRepository.save(habit);

        return new GroupHabitResponse(habit.getId(), habit.getTitle(), habit.getDescription());
    }

    /**
     * Deletes a habit/task definition from a group.
     *
     * @param groupId the ID of the group
     * @param habitId the ID of the habit
     * @param userId  the user requesting the deletion (must be owner)
     * @throws ResponseStatusException 404 if group/habit not found, 403 if not owner
     */
    public void deleteHabit(Long groupId, Long habitId, Long userId) {
        log.info("User {} attempting to delete habit {} in group {}", userId, habitId, groupId);
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        if (!group.getOwnerId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the group owner can delete habits");
        }

        GroupHabit habit = groupHabitRepository.findById(habitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Habit not found"));

        if (!habit.getGroupId().equals(groupId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Habit does not belong to this group");
        }

        groupHabitRepository.deleteById(habitId);
    }

    /**
     * Retrieves full group details including members and habit list.
     *
     * @param groupId the ID of the group
     * @return the group as a {@link GroupResponse}
     * @throws ResponseStatusException 404 if group not found
     */
    public GroupResponse getGroup(Long groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));
        return toResponse(group);
    }

    /**
     * Maps a {@link Group} entity to a {@link GroupResponse} DTO.
     *
     * @param group the entity to convert
     * @return populated response DTO
     */
    private GroupResponse toResponse(Group group) {
        List<Long> memberIds = groupMemberRepository.findByGroupId(group.getId())
                .stream().map(GroupMember::getUserId).collect(Collectors.toList());
        List<GroupHabitResponse> habits = groupHabitRepository.findByGroupId(group.getId())
                .stream().map(h -> new GroupHabitResponse(h.getId(), h.getTitle(), h.getDescription()))
                .collect(Collectors.toList());
        return new GroupResponse(group.getId(), group.getName(), group.getInviteCode(),
                group.getOwnerId(), memberIds, habits);
    }

    /**
     * Generates a short, uppercase, URL-safe invite code.
     *
     * @return an 8-character alphanumeric invite code
     */
    private String generateInviteCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }
}
