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
        group.setCompetitionActive(false); // Can be enabled if they want to track it
        group.setDescription(request.getDescription());
        group.setDuration(request.getDuration());
        
        // Calculate competition end date if duration is provided
        LocalDateTime endDate = calculateEndDate(request.getDuration());
        if (endDate != null) {
            group.setCompetitionStartDate(LocalDateTime.now());
            group.setCompetitionEndDate(endDate);
            group.setCompetitionActive(true);
        }

        group = groupRepository.save(group);

        // Automatically add owner as first member and admin
        GroupMember member = new GroupMember(null, group.getId(), userId, LocalDateTime.now(), true);
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

        GroupMember member = new GroupMember(null, group.getId(), userId, LocalDateTime.now(), false);
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
        List<GroupMember> members = groupMemberRepository.findByGroupId(group.getId());
        List<Long> memberIds = members.stream().map(GroupMember::getUserId).collect(Collectors.toList());
        List<Long> adminIds = members.stream()
                .filter(m -> m.getIsAdmin() != null && m.getIsAdmin())
                .map(GroupMember::getUserId)
                .collect(Collectors.toList());

        List<GroupHabitResponse> habits = groupHabitRepository.findByGroupId(group.getId()).stream()
                .map(h -> new GroupHabitResponse(h.getId(), h.getTitle(), h.getDescription()))
                .collect(Collectors.toList());

        return new GroupResponse(
                group.getId(),
                group.getName(),
                group.getInviteCode(),
                group.getOwnerId(),
                memberIds,
                adminIds,
                habits,
                group.getDescription(),
                group.getDuration(),
                group.getCompetitionEndDate()
        );
    }

    /**
     * Returns all groups the given user is a member of.
     *
     * @param userId the user ID
     * @return list of GroupResponses
     */
    public List<GroupResponse> getUserGroups(Long userId) {
        return groupMemberRepository.findByUserId(userId).stream()
                .map(member -> groupRepository.findById(member.getGroupId()).orElse(null))
                .filter(group -> group != null)
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Generates a short, uppercase, URL-safe invite code.
     *
     * @return an 8-character alphanumeric invite code
     */
    private String generateInviteCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    /**
     * Changes the competition deadline of a group.
     */
    public GroupResponse changeDeadline(Long groupId, Long userId, ChangeDeadlineRequest request) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        GroupMember member = groupMemberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member"));

        boolean isRequesterAdmin = member.getIsAdmin() != null && member.getIsAdmin();
        if (!isRequesterAdmin && !group.getOwnerId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only group admins can change the deadline");
        }

        if ("SET".equalsIgnoreCase(request.getMode())) {
            group.setCompetitionEndDate(request.getNewDate());
        } else {
            LocalDateTime baseDate = group.getCompetitionEndDate() != null && group.getCompetitionEndDate().isAfter(LocalDateTime.now()) 
                    ? group.getCompetitionEndDate() 
                    : LocalDateTime.now();

            int years = request.getYears() != null ? request.getYears() : 0;
            int months = request.getMonths() != null ? request.getMonths() : 0;
            int weeks = request.getWeeks() != null ? request.getWeeks() : 0;
            int days = request.getDays() != null ? request.getDays() : 0;

            if ("REDUCE".equalsIgnoreCase(request.getMode())) {
                baseDate = baseDate.minusYears(years).minusMonths(months).minusWeeks(weeks).minusDays(days);
                // Ensure we don't set a date in the past
                if (baseDate.isBefore(LocalDateTime.now())) {
                    baseDate = LocalDateTime.now();
                }
            } else {
                baseDate = baseDate.plusYears(years).plusMonths(months).plusWeeks(weeks).plusDays(days);
            }
            group.setCompetitionEndDate(baseDate);
        }

        group.setCompetitionActive(group.getCompetitionEndDate() != null);
        groupRepository.save(group);

        return toResponse(group);
    }

    /**
     * Promotes a member to an admin.
     */
    public GroupResponse promoteToAdmin(Long groupId, Long targetUserId, Long requestingUserId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        GroupMember requester = groupMemberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getUserId().equals(requestingUserId))
                .findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member"));

        boolean isRequesterAdmin = requester.getIsAdmin() != null && requester.getIsAdmin();
        if (!isRequesterAdmin && !group.getOwnerId().equals(requestingUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only group admins can promote others");
        }

        GroupMember target = groupMemberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getUserId().equals(targetUserId))
                .findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user is not a member of this group"));

        target.setIsAdmin(true);
        groupMemberRepository.save(target);

        return toResponse(group);
    }

    private LocalDateTime calculateEndDate(String duration) {
        if (duration == null || duration.equalsIgnoreCase("Indefinite")) {
            return null;
        }
        duration = duration.toLowerCase().trim();
        LocalDateTime baseDate = LocalDateTime.now();
        try {
            String[] parts = duration.split(" ");
            int amount = Integer.parseInt(parts[0]);
            String unit = parts[1];
            if (unit.contains("day")) return baseDate.plusDays(amount);
            if (unit.contains("week")) return baseDate.plusWeeks(amount);
            if (unit.contains("month")) return baseDate.plusMonths(amount);
            if (unit.contains("year")) return baseDate.plusYears(amount);
        } catch (Exception e) {
            log.warn("Failed to parse duration: {}", duration);
        }
        return null;
    }
}
