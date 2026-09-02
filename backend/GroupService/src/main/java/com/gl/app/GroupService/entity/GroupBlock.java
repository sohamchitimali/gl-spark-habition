package com.gl.app.GroupService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "group_blocks")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupBlock {
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false) 
    private Long groupId;
    
    @Column(nullable = false) 
    private Long blockedUserId;
    
    @Column(nullable = false) 
    private Long blockedByUserId;
    
    private LocalDateTime blockedAt = LocalDateTime.now();
}

