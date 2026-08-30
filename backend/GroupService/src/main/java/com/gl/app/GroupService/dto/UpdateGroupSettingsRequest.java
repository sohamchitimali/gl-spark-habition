package com.gl.app.GroupService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateGroupSettingsRequest {
    private String name;
    private String description;
    private Double latitude;
    private Double longitude;
    private String addressDisplay;
    private List<String> tags;
    private Boolean notificationsEnabled;
}
