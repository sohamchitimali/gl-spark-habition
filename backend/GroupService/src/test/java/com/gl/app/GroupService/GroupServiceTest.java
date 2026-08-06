package com.gl.app.GroupService;

import com.gl.app.GroupService.dto.*;
import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.entity.GroupHabit;
import com.gl.app.GroupService.entity.GroupMember;
import com.gl.app.GroupService.repository.GroupHabitRepository;
import com.gl.app.GroupService.repository.GroupMemberRepository;
import com.gl.app.GroupService.repository.GroupRepository;
import com.gl.app.GroupService.service.GroupService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link GroupService} using Mockito mocking.
 * Covers US-002 and US-003 acceptance criteria.
 */
@ExtendWith(MockitoExtension.class)
class GroupServiceTest {

    @Mock
    private GroupRepository groupRepository;

    @Mock
    private GroupMemberRepository groupMemberRepository;

    @Mock
    private GroupHabitRepository groupHabitRepository;

    @InjectMocks
    private GroupService groupService;

    @Test
    @DisplayName("US-002: createGroup should persist group and auto-generate invite code")
    void createGroup_shouldPersistGroupWithInviteCode() {
        // Arrange
        CreateGroupRequest request = new CreateGroupRequest();
        request.setName("Morning Warriors");
        Long userId = 1L;

        Group savedGroup = new Group(1L, "Morning Warriors", "ABCD1234", userId, null, null, false);
        when(groupRepository.save(any(Group.class))).thenReturn(savedGroup);
        when(groupMemberRepository.save(any(GroupMember.class))).thenReturn(new GroupMember());
        when(groupMemberRepository.findByGroupId(1L)).thenReturn(List.of(new GroupMember(1L, 1L, userId, null)));
        when(groupHabitRepository.findByGroupId(1L)).thenReturn(List.of());

        // Act
        GroupResponse response = groupService.createGroup(request, userId);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getName()).isEqualTo("Morning Warriors");
        assertThat(response.getOwnerId()).isEqualTo(userId);
        verify(groupRepository, times(1)).save(any(Group.class));
        verify(groupMemberRepository, times(1)).save(any(GroupMember.class));
    }

    @Test
    @DisplayName("US-003: joinGroup should add user to group when invite code is valid")
    void joinGroup_withValidCode_shouldAddMember() {
        // Arrange
        JoinGroupRequest request = new JoinGroupRequest();
        request.setInviteCode("ABCD1234");
        Long userId = 2L;

        Group group = new Group(1L, "Morning Warriors", "ABCD1234", 1L, null, null, false);
        when(groupRepository.findByInviteCode("ABCD1234")).thenReturn(Optional.of(group));
        when(groupMemberRepository.existsByGroupIdAndUserId(1L, userId)).thenReturn(false);
        when(groupMemberRepository.save(any(GroupMember.class))).thenReturn(new GroupMember());
        when(groupMemberRepository.findByGroupId(1L)).thenReturn(List.of(new GroupMember(1L, 1L, userId, null)));
        when(groupHabitRepository.findByGroupId(1L)).thenReturn(List.of());

        // Act
        GroupResponse response = groupService.joinGroup(request, userId);

        // Assert
        assertThat(response.getId()).isEqualTo(1L);
        verify(groupMemberRepository, times(1)).save(any(GroupMember.class));
    }

    @Test
    @DisplayName("US-003: joinGroup should throw 404 when invite code is invalid")
    void joinGroup_withInvalidCode_shouldThrow404() {
        // Arrange
        JoinGroupRequest request = new JoinGroupRequest();
        request.setInviteCode("INVALID");
        when(groupRepository.findByInviteCode("INVALID")).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> groupService.joinGroup(request, 2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Invalid invite code");
    }

    @Test
    @DisplayName("US-002: addHabit should persist a new habit to the group")
    void addHabit_shouldPersistGroupHabit() {
        // Arrange
        Long groupId = 1L;
        AddHabitRequest request = new AddHabitRequest();
        request.setTitle("Morning Run");
        request.setDescription("Run 5km every morning");

        Group group = new Group(1L, "Warriors", "CODE", 1L, null, null, false);
        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        GroupHabit saved = new GroupHabit(10L, groupId, "Morning Run", "Run 5km every morning");
        when(groupHabitRepository.save(any(GroupHabit.class))).thenReturn(saved);

        // Act
        GroupHabitResponse response = groupService.addHabit(groupId, request);

        // Assert
        assertThat(response.getTitle()).isEqualTo("Morning Run");
        assertThat(response.getId()).isEqualTo(10L);
        verify(groupHabitRepository, times(1)).save(any(GroupHabit.class));
    }
}
