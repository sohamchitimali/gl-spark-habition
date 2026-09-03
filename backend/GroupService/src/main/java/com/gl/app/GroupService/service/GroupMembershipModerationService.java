package com.gl.app.GroupService.service;

import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.entity.GroupMember;
import com.gl.app.GroupService.entity.GroupBlock;
import com.gl.app.GroupService.repository.GroupRepository;
import com.gl.app.GroupService.repository.GroupMemberRepository;
import com.gl.app.GroupService.repository.GroupBlockRepository;
import com.gl.app.GroupService.client.HabitServiceClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Slf4j
public class GroupMembershipModerationService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupBlockRepository groupBlockRepository;
    private final HabitServiceClient habitServiceClient;
    private final MeilisearchSyncService meilisearchSyncService;

    public GroupMembershipModerationService(GroupRepository groupRepository,
                                           GroupMemberRepository groupMemberRepository,
                                           GroupBlockRepository groupBlockRepository,
                                           HabitServiceClient habitServiceClient,
                                           MeilisearchSyncService meilisearchSyncService) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupBlockRepository = groupBlockRepository;
        this.habitServiceClient = habitServiceClient;
        this.meilisearchSyncService = meilisearchSyncService;
    }

    @org.springframework.transaction.annotation.Transactional
    public void kickMember(Long groupId, Long targetUserId, Long actingUserId) {
        processKick(groupId, targetUserId, actingUserId, false);
    }

    @org.springframework.transaction.annotation.Transactional
    public void kickAndBlockMember(Long groupId, Long targetUserId, Long actingUserId) {
        processKick(groupId, targetUserId, actingUserId, true);
    }

    private void processKick(Long groupId, Long targetUserId, Long actingUserId, boolean block) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        if (group.getOwnerId().equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot kick the owner of the group.");
        }

        boolean isActingOwner = group.getOwnerId().equals(actingUserId);
        
        GroupMember actingMember = groupMemberRepository.findByGroupIdAndUserId(groupId, actingUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member"));
        
        boolean isActingAdmin = isActingOwner || (actingMember.getIsAdmin() != null && actingMember.getIsAdmin());
        
        if (!isActingAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only admins can kick members.");
        }

        GroupMember targetMember = groupMemberRepository.findByGroupIdAndUserId(groupId, targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user is not a member"));

        boolean isTargetAdmin = targetMember.getIsAdmin() != null && targetMember.getIsAdmin();

        // Permissions Matrix Enforcement
        if (isTargetAdmin && !isActingOwner) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admins cannot kick other admins. Only the owner can do this.");
        }

        // Proceed to kick
        groupMemberRepository.delete(targetMember);
        
        // Update member count accurately
        group.setMemberCount(Math.max(0, group.getMemberCount() - 1));
        groupRepository.save(group);
        meilisearchSyncService.syncGroup(group);

        // Remove user's tracking habits in HabitService
        try {
            habitServiceClient.removeUserFromGroup(groupId, targetUserId);
        } catch (Exception e) {
            log.error("Failed to remove tracking habits for user {} in group {}", targetUserId, groupId, e);
        }

        if (block) {
            if (!groupBlockRepository.existsByGroupIdAndBlockedUserId(groupId, targetUserId)) {
                GroupBlock groupBlock = new GroupBlock();
                groupBlock.setGroupId(groupId);
                groupBlock.setBlockedUserId(targetUserId);
                groupBlock.setBlockedByUserId(actingUserId);
                groupBlockRepository.save(groupBlock);
            }
        }
    }
}

