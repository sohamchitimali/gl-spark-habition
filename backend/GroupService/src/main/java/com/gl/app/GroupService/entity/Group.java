package com.gl.app.GroupService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * JPA entity representing a Habit Group.
 * Groups are owned by a user, have a unique invite code,
 * and can hold time-bound competitions between members.
 */
@Entity
@Table(name = "habit_groups")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Display name of the group. */
    @Column(nullable = false)
    private String name;

    /** Unique code used to invite other users. */
    @Column(unique = true, nullable = false)
    private String inviteCode;

    /** ID of the user who created the group. */
    @Column(nullable = false)
    private Long ownerId;

    /** Competition start timestamp; null if no competition is set. */
    private LocalDateTime competitionStartDate;

    /** Competition end timestamp; null if no competition is set. */
    private LocalDateTime competitionEndDate;

    /** Whether a competition is currently active. */
    @Column(nullable = false)
    private Boolean competitionActive = false;
    
    /** Description of the group. */
    @Column(columnDefinition = "TEXT")
    private String description;
    
    /** Duration of the competition (e.g. 'Days', 'Weeks', 'Months', 'Indefinite'). */
    private String duration;
}
