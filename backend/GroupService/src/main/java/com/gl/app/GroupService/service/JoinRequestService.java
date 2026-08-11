package com.gl.app.GroupService.service;

import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.entity.GroupJoinRequest;
import com.gl.app.GroupService.entity.GroupMember;
import com.gl.app.GroupService.entity.RequestStatus;
import com.gl.app.GroupService.entity.DirectMessage;
import com.gl.app.GroupService.entity.Discoverability;
import com.gl.app.GroupService.repository.GroupRepository;
import com.gl.app.GroupService.repository.GroupMemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.gl.app.GroupService.repository.GroupJoinRequestRepository;
import com.gl.app.GroupService.repository.DirectMessageRepository;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class JoinRequestService {

    @Autowired
    private GroupJoinRequestRepository joinRequestRepository;

    @Autowired
    private DirectMessageRepository dmRepository;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMemberRepository memberRepository;

    public GroupJoinRequest requestToJoin(Long groupId, Long userId, String initialMessage) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Group not found"));

        if (memberRepository.existsByGroupIdAndUserId(groupId, userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already a member");
        }

        if (group.getVisibility() == Discoverability.PUBLIC) {
            // Auto-approve and join immediately
            GroupMember member = new GroupMember(null, group.getId(), userId, LocalDateTime.now(), false);
            memberRepository.save(member);
            
            GroupJoinRequest req = new GroupJoinRequest();
            req.setGroupId(groupId);
            req.setApplicantId(userId);
            req.setStatus(RequestStatus.APPROVED);
            req.setInitialMessage("Auto-approved for OPEN group");
            return joinRequestRepository.save(req);
        }

        // Create pending request
        GroupJoinRequest req = new GroupJoinRequest();
        req.setGroupId(groupId);
        req.setApplicantId(userId);
        req.setStatus(RequestStatus.PENDING);
        req.setInitialMessage(initialMessage);
        
        return joinRequestRepository.save(req);
    }

    public List<GroupJoinRequest> getPendingRequests(Long groupId, Long adminId) {
        validateAdmin(groupId, adminId);
        return joinRequestRepository.findByGroupIdAndStatus(groupId, RequestStatus.PENDING);
    }

    public List<com.gl.app.GroupService.dto.SentJoinRequestResponse> getMySentRequests(Long applicantId) {
        return joinRequestRepository.findByApplicantId(applicantId).stream().map(req -> {
            String groupName = groupRepository.findById(req.getGroupId())
                    .map(com.gl.app.GroupService.entity.Group::getName)
                    .orElse("Unknown Group");
            return new com.gl.app.GroupService.dto.SentJoinRequestResponse(
                    req.getId(), req.getGroupId(), groupName, req.getApplicantId(),
                    req.getStatus(), req.getInitialMessage(), req.getCreatedAt(), req.getUpdatedAt()
            );
        }).collect(java.util.stream.Collectors.toList());
    }

    public void approveRequest(Long groupId, Long requestId, Long adminId) {
        validateAdmin(groupId, adminId);
        GroupJoinRequest req = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
                
        if (!req.getGroupId().equals(groupId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mismatch");
        
        req.setStatus(RequestStatus.APPROVED);
        joinRequestRepository.save(req);
        
        GroupMember member = new GroupMember(null, groupId, req.getApplicantId(), LocalDateTime.now(), false);
        memberRepository.save(member);
    }

    public void rejectRequest(Long groupId, Long requestId, Long adminId) {
        validateAdmin(groupId, adminId);
        GroupJoinRequest req = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
                
        req.setStatus(RequestStatus.REJECTED);
        joinRequestRepository.save(req);
    }

    public DirectMessage sendDM(Long groupId, Long requestId, Long senderId, String content) {
        GroupJoinRequest req = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        
        Long receiverId = senderId.equals(req.getApplicantId()) ? getGroupAdmin(groupId) : req.getApplicantId();
        
        DirectMessage dm = new DirectMessage();
        dm.setGroupId(groupId);
        dm.setSenderId(senderId);
        dm.setReceiverId(receiverId);
        dm.setContent(content);
        return dmRepository.save(dm);
    }

    public List<DirectMessage> getMessages(Long groupId, Long requestId) {
        GroupJoinRequest req = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        // For simplicity in prototype, just fetching by group ID and applicant
        Long applicantId = req.getApplicantId();
        Long adminId = getGroupAdmin(groupId);
        return dmRepository.findByGroupIdAndParticipants(groupId, applicantId, adminId);
    }

    private void validateAdmin(Long groupId, Long userId) {
        GroupMember member = memberRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member"));
        if (!member.getIsAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not an admin");
        }
    }
    
    private Long getGroupAdmin(Long groupId) {
        return groupRepository.findById(groupId).map(Group::getOwnerId).orElseThrow();
    }
}
