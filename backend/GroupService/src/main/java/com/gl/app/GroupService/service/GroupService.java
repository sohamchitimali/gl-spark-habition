package com.gl.app.GroupService.service;

import com.gl.app.GroupService.dto.*;
import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.entity.GroupHabit;
import com.gl.app.GroupService.entity.GroupMember;
import com.gl.app.GroupService.repository.GroupHabitRepository;
import com.gl.app.GroupService.repository.GroupMemberRepository;
import com.gl.app.GroupService.repository.GroupRepository;
import com.gl.app.GroupService.repository.GroupJoinRequestRepository;
import com.gl.app.GroupService.repository.DirectMessageRepository;
import com.gl.app.GroupService.entity.RequestStatus;
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

    @Autowired
    private GroupJoinRequestRepository groupJoinRequestRepository;

    @Autowired
    private DirectMessageRepository directMessageRepository;

    @Autowired
    private MeilisearchSyncService meilisearchSyncService;

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
        com.gl.app.GroupService.entity.Discoverability vis = com.gl.app.GroupService.entity.Discoverability.INVITE_ONLY;
        if (request.getVisibility() != null) {
            try { vis = com.gl.app.GroupService.entity.Discoverability.valueOf(request.getVisibility().toUpperCase()); } catch (Exception ignored) {}
        }
        group.setVisibility(vis);

        int years = request.getYears() != null ? request.getYears() : 0;
        int months = request.getMonths() != null ? request.getMonths() : 0;
        int weeks = request.getWeeks() != null ? request.getWeeks() : 0;
        int days = request.getDays() != null ? request.getDays() : 0;

        if (years > 0 || months > 0 || weeks > 0 || days > 0) {
            LocalDateTime endDate = LocalDateTime.now().plusYears(years).plusMonths(months).plusWeeks(weeks).plusDays(days);
            group.setCompetitionStartDate(LocalDateTime.now());
            group.setCompetitionEndDate(endDate);
            group.setCompetitionActive(true);
            group.setDuration(years + "y " + months + "m " + weeks + "w " + days + "d");
        } else {
            group.setDuration("Indefinite");
            group.setCompetitionActive(false);
        }

        group = groupRepository.save(group);

        // Automatically add owner as first member and admin
        GroupMember member = new GroupMember(null, group.getId(), userId, LocalDateTime.now(), true);
        groupMemberRepository.save(member);

        // Add invited friends directly
        if (request.getInviteFriendIds() != null) {
            for (Long friendId : request.getInviteFriendIds()) {
                if (!friendId.equals(userId)) {
                    GroupMember friendMember = new GroupMember(null, group.getId(), friendId, LocalDateTime.now(), false);
                    groupMemberRepository.save(friendMember);
                }
            }
        }

        log.info("Group created with id={} inviteCode={}", group.getId(), group.getInviteCode());
        
        // Sync to Meilisearch
        meilisearchSyncService.syncGroup(group);
        
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

    public boolean hasUserRequested(Long groupId, Long userId) {
        return groupJoinRequestRepository.findByGroupIdAndStatus(groupId, RequestStatus.PENDING)
                .stream().anyMatch(r -> r.getApplicantId().equals(userId));
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

        boolean hasPending = groupJoinRequestRepository.findByGroupIdAndStatus(group.getId(), RequestStatus.PENDING).size() > 0;

        return new GroupResponse(
                group.getId(),
                group.getName(),
                group.getInviteCode(),
                group.getOwnerId(),
                memberIds,
                adminIds,
                habits,
                group.getVisibility() != null ? group.getVisibility().name() : null,
                hasPending,
                false, // currentUserRequested default
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

        if (!group.getOwnerId().equals(userId)) {
            // Check if admin
            boolean isAdmin = groupMemberRepository.findByGroupId(groupId).stream()
                    .anyMatch(m -> m.getUserId().equals(userId) && Boolean.TRUE.equals(m.getIsAdmin()));
            if (!isAdmin) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can change deadline");
            }
        }

        LocalDateTime newDeadline = LocalDateTime.now();
        if ("ADD".equals(request.getMode())) {
            newDeadline = group.getCompetitionEndDate() != null ? group.getCompetitionEndDate() : LocalDateTime.now();
            newDeadline = newDeadline.plusYears(request.getYears() != null ? request.getYears() : 0)
                                     .plusMonths(request.getMonths() != null ? request.getMonths() : 0)
                                     .plusWeeks(request.getWeeks() != null ? request.getWeeks() : 0)
                                     .plusDays(request.getDays() != null ? request.getDays() : 0);
        } else if ("REDUCE".equals(request.getMode())) {
            newDeadline = group.getCompetitionEndDate() != null ? group.getCompetitionEndDate() : LocalDateTime.now();
            newDeadline = newDeadline.minusYears(request.getYears() != null ? request.getYears() : 0)
                                     .minusMonths(request.getMonths() != null ? request.getMonths() : 0)
                                     .minusWeeks(request.getWeeks() != null ? request.getWeeks() : 0)
                                     .minusDays(request.getDays() != null ? request.getDays() : 0);
        } else if ("SET".equals(request.getMode()) && request.getNewDate() != null) {
            newDeadline = request.getNewDate();
        }

        group.setCompetitionEndDate(newDeadline);
        return toResponse(groupRepository.save(group));
    }

    /**
     * Promotes a member to admin.
     */
    public GroupResponse promoteToAdmin(Long groupId, Long targetId, Long userId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        if (!group.getOwnerId().equals(userId)) {
            // Check if admin
            boolean isAdmin = groupMemberRepository.findByGroupId(groupId).stream()
                    .anyMatch(m -> m.getUserId().equals(userId) && Boolean.TRUE.equals(m.getIsAdmin()));
            if (!isAdmin) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can promote users");
            }
        }

        GroupMember target = groupMemberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getUserId().equals(targetId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user is not a member"));

        target.setIsAdmin(true);
        groupMemberRepository.save(target);

        return toResponse(group);
    }

    /**
     * Deletes a group entirely (owner only).
     */
    public void deleteGroup(Long groupId, Long userId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        if (!group.getOwnerId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can delete the group");
        }

        // Delete dependencies
        groupHabitRepository.deleteAll(groupHabitRepository.findByGroupId(groupId));
        groupMemberRepository.deleteAll(groupMemberRepository.findByGroupId(groupId));
        groupJoinRequestRepository.deleteAll(groupJoinRequestRepository.findByGroupId(groupId));
        directMessageRepository.deleteByGroupId(groupId);
        
        // Remove from Meilisearch
        meilisearchSyncService.deleteGroup(groupId);
        
        groupRepository.delete(group);
    }

    /**
     * Leaves a group (members only). Owners cannot leave without deleting or transferring ownership.
     */
    public void leaveGroup(Long groupId, Long userId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        if (group.getOwnerId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner cannot leave the group. Delete the group instead.");
        }

        GroupMember member = groupMemberRepository.findByGroupId(groupId).stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "You are not a member of this group"));

        groupMemberRepository.delete(member);
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
