package com.gl.app.GroupService.repository;

import com.gl.app.GroupService.entity.GroupJoinRequest;
import com.gl.app.GroupService.entity.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, Long> {
    List<GroupJoinRequest> findByGroupIdAndStatus(Long groupId, RequestStatus status);
    List<GroupJoinRequest> findByGroupIdInAndStatus(List<Long> groupIds, RequestStatus status);
    List<GroupJoinRequest> findByGroupId(Long groupId);
    List<GroupJoinRequest> findByApplicantId(Long applicantId);
}
