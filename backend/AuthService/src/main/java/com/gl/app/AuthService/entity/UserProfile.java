package com.gl.app.AuthService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "user_profiles")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserProfile {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @OneToOne
    @JoinColumn(name = "user_id", unique = true, nullable = false)
    private User user;
    
    private String name;
    private String preferredColor;
    
    @Column(columnDefinition = "TEXT")
    private String bio;
    
    private String habitGoals;
    private String languages;
    private String timeZone;
    
    private Double latitude;
    private Double longitude;
    private String addressDisplay;
    
    @Enumerated(EnumType.STRING)
    private Visibility locationVisibility = Visibility.PUBLIC;
    
    @ManyToMany
    @JoinTable(
        name = "user_profile_tags",
        joinColumns = @JoinColumn(name = "user_profile_id"),
        inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private List<Tag> tags = new ArrayList<>();
}
