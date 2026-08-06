package com.gl.app.GroupService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * JPA entity representing membership of a user in a {@link Group}.
 */
@Entity
@Table(
    name = "group_members",
    uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "user_id"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** Timestamp when the user joined the group. */
    private LocalDateTime joinedAt;
}
