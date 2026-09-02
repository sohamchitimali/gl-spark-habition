package com.gl.app.HabitService.dto;

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
    private String userTheme;
    private String location;
    private String genreOfInterest;
    private String bio;
    private String timeZone;
    private Boolean autoTimezone;
}

