package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BulkAssignRequest {
    private Long groupId;
    private List<Long> userIds;
}
