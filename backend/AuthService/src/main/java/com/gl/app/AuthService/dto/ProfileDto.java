package com.gl.app.AuthService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProfileDto {
    private String username;
    private String name;
    private String preferredColor;
    private String location;
    private String addressDisplay;
    private Double latitude;
    private Double longitude;
    private String timeZone;
    private String experience;
    private String schedule;
    private String locationVisibility;
    private String bio;
    private java.util.List<String> tags;
}
