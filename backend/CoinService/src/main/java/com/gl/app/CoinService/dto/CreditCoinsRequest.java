package com.gl.app.CoinService.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for crediting coins to a user.
 * Sent from HabitService on every habit completion.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreditCoinsRequest {

    @NotNull
    private Long userId;

    @NotNull
    @Min(value = 1, message = "Coins must be at least 1")
    private Integer amount;

    private String reason;

    /** The group context; null for personal habits. */
    private Long groupId;
}
