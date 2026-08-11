package com.gl.app.GroupService.dto;

import lombok.Data;

import java.util.List;

@Data
public class SearchGroupRequest {
    private String query;
    private List<String> userTags;
    private Double userLat;
    private Double userLng;
}
