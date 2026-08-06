package com.gl.app.AuthService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProfileDto {
    private String name;
    private String preferredColor;
    private String location;
    private String genreOfInterest;
    private String bio;
}
