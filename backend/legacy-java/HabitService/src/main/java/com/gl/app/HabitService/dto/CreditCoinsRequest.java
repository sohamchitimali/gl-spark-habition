package com.gl.app.HabitService.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreditCoinsRequest {
    private Long userId;
    private Integer amount;
    private String reason;
    private Long groupId;
}
