package com.gl.app.GroupService.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ChangeDeadlineRequest {
    // Mode can be "ADD", "REDUCE", or "SET"
    private String mode;
    
    // For ADD and REDUCE modes
    private Integer years;
    private Integer months;
    private Integer weeks;
    private Integer days;
    
    // For SET mode
    private LocalDateTime newDate;
}
