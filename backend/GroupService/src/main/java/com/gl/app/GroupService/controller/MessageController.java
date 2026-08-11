package com.gl.app.GroupService.controller;

import com.gl.app.GroupService.entity.DirectMessage;
import com.gl.app.GroupService.repository.DirectMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.gl.app.GroupService.dto.NotificationSummary;
import com.gl.app.GroupService.entity.DirectMessage;
import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.repository.GroupJoinRequestRepository;
import com.gl.app.GroupService.repository.GroupRepository;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;

import com.gl.app.GroupService.repository.GroupMemberRepository;
import com.gl.app.GroupService.entity.GroupMember;
import java.util.Collections;

@RestController
@RequestMapping("/messages")
public class MessageController {

    @Autowired
    private DirectMessageRepository directMessageRepository;
    
    @Autowired
    private GroupRepository groupRepository;
    
    @Autowired
    private GroupJoinRequestRepository joinRequestRepository;
    
    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @GetMapping
    public ResponseEntity<List<DirectMessage>> getMyMessages(@RequestHeader("X-User-Id") Long userId) {
        List<Long> userGroupIds = groupMemberRepository.findByUserId(userId)
                .stream().map(GroupMember::getGroupId).collect(Collectors.toList());
                
        // If user is in no groups, pass a dummy list containing -1 to prevent SQL syntax error in IN clause
        if (userGroupIds.isEmpty()) {
            userGroupIds = Collections.singletonList(-1L);
        }
        
        List<DirectMessage> messages = directMessageRepository.findUserMessages(userId, userGroupIds);
        return ResponseEntity.ok(messages);
    }
    
    @PostMapping("/{messageId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable Long messageId,
            @RequestHeader("X-User-Id") Long userId) {
        DirectMessage message = directMessageRepository.findById(messageId).orElse(null);
        // Only mark as read if it's a DM specifically to this user
        if (message != null && message.getReceiverId() != null && message.getReceiverId().equals(userId)) {
            message.setIsRead(true);
            directMessageRepository.save(message);
        }
        return ResponseEntity.ok().build();
    }
    
    @GetMapping("/notifications")
    public ResponseEntity<NotificationSummary> getNotifications(@RequestHeader("X-User-Id") Long userId) {
        int unreadMsgs = (int) directMessageRepository.findBySenderIdOrReceiverIdOrderByCreatedAtAsc(userId, userId)
                .stream()
                .filter(m -> m.getReceiverId() != null && m.getReceiverId().equals(userId) && !m.getIsRead())
                .count();
                
        int pendingReqs = 0;
        List<Group> ownedGroups = groupRepository.findByOwnerId(userId);
        if (!ownedGroups.isEmpty()) {
            List<Long> groupIds = ownedGroups.stream().map(Group::getId).collect(Collectors.toList());
            pendingReqs = joinRequestRepository.findByGroupIdInAndStatus(groupIds, com.gl.app.GroupService.entity.RequestStatus.PENDING).size();
        }
        
        return ResponseEntity.ok(new NotificationSummary(unreadMsgs, pendingReqs));
    }
    
    @PostMapping
    public ResponseEntity<DirectMessage> sendMessage(
            @RequestHeader("X-User-Id") Long userId,
            @RequestBody Map<String, Object> payload) {
            
        String content = payload.get("content").toString();
        
        DirectMessage dm = new DirectMessage();
        dm.setSenderId(userId);
        dm.setContent(content);
        
        if (payload.containsKey("chatType") && "GROUP".equals(payload.get("chatType").toString())) {
            dm.setChatType("GROUP");
            dm.setGroupId(Long.valueOf(payload.get("groupId").toString()));
            dm.setReceiverId(null);
        } else if (payload.containsKey("groupId")) {
            // Join Request Chat
            dm.setChatType("JOIN_REQUEST");
            dm.setGroupId(Long.valueOf(payload.get("groupId").toString()));
            dm.setReceiverId(Long.valueOf(payload.get("receiverId").toString()));
        } else {
            // Standard DM
            dm.setChatType("DIRECT_MESSAGE");
            dm.setReceiverId(Long.valueOf(payload.get("receiverId").toString()));
        }
        
        return ResponseEntity.ok(directMessageRepository.save(dm));
    }

    @DeleteMapping("/direct/{otherUserId}")
    public ResponseEntity<Void> deleteDirectChat(
            @PathVariable Long otherUserId,
            @RequestHeader("X-User-Id") Long userId) {
        directMessageRepository.deleteChatBetweenUsers(userId, otherUserId);
        return ResponseEntity.noContent().build();
    }
}
