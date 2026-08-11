package com.gl.app.AuthService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileDto {
    private Long id;
    private String email;
    private String username;
    private String name;
    private String preferredColor;
    private String location;
    private String genreOfInterest;
    private String bio;
}
