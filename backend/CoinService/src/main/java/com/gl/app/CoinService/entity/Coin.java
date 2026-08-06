package com.gl.app.CoinService.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * JPA entity representing a single coin transaction for a user.
 * Each record is immutable — coins are never deducted, only credited.
 */
@Entity
@Table(name = "coin_transactions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Coin {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The user who earned the coins. */
    @Column(nullable = false)
    private Long userId;

    /** Number of coins credited in this transaction. */
    @Column(nullable = false)
    private Integer amount;

    /** Human-readable reason (e.g., "Habit completion: Morning Run"). */
    private String reason;

    /** Group context; null for personal habit completions. */
    private Long groupId;
}
