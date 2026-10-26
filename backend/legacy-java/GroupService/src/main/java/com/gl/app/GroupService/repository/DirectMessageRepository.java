package com.gl.app.GroupService.repository;

import com.gl.app.GroupService.entity.DirectMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface DirectMessageRepository extends JpaRepository<DirectMessage, Long> {
    
    @Query("SELECT d FROM DirectMessage d WHERE d.groupId = :groupId AND ((d.senderId = :userA AND d.receiverId = :userB) OR (d.senderId = :userB AND d.receiverId = :userA)) ORDER BY d.createdAt ASC")
    List<DirectMessage> findByGroupIdAndParticipants(@Param("groupId") Long groupId, @Param("userA") Long userA, @Param("userB") Long userB);

    List<DirectMessage> findBySenderIdOrReceiverIdOrderByCreatedAtAsc(Long senderId, Long receiverId);

    @Query("SELECT d FROM DirectMessage d WHERE d.senderId = :userId OR d.receiverId = :userId OR (d.chatType = 'GROUP' AND d.groupId IN :groupIds) ORDER BY d.createdAt ASC")
    List<DirectMessage> findUserMessages(@Param("userId") Long userId, @Param("groupIds") List<Long> groupIds);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM DirectMessage d WHERE d.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") Long groupId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @Query("DELETE FROM DirectMessage d WHERE (d.senderId = :userA AND d.receiverId = :userB) OR (d.senderId = :userB AND d.receiverId = :userA)")
    void deleteChatBetweenUsers(@Param("userA") Long userA, @Param("userB") Long userB);
}
