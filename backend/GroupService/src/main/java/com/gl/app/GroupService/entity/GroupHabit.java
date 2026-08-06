package com.gl.app.GroupService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * JPA entity representing a habit/task that belongs to a {@link Group}.
 * All members of the group track this habit.
 */
@Entity
@Table(name = "group_habits")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupHabit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long groupId;

    /** Short name or title of the habit task. */
    @Column(nullable = false)
    private String title;

    /** Optional description / instructions for the habit. */
    private String description;
}
