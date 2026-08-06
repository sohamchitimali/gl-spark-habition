package com.gl.app.CoinService.controller;

import com.gl.app.CoinService.dto.CreditCoinsRequest;
import com.gl.app.CoinService.dto.LeaderboardResponse;
import com.gl.app.CoinService.entity.Coin;
import com.gl.app.CoinService.service.CoinService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for coin management and leaderboard endpoints.
 * Covers US-006, US-007, and US-008.
 */
@RestController
@Slf4j
public class CoinController {

    @Autowired
    private CoinService coinService;

    /**
     * Credits coins to a user (called internally by HabitService).
     * Relates to US-006.
     *
     * @param request the credit request with userId, amount, and reason
     * @return 201 Created with the coin transaction record
     */
    @PostMapping("/coins/credit")
    public ResponseEntity<Coin> creditCoins(@RequestBody @Valid CreditCoinsRequest request) {
        return new ResponseEntity<>(coinService.creditCoins(request), HttpStatus.CREATED);
    }

    /**
     * Returns the leaderboard for a group sorted by coins earned.
     * Relates to US-007.
     *
     * @param groupId the group ID
     * @return 200 OK with ranked leaderboard entries
     */
    @GetMapping("/coins/groups/{groupId}/leaderboard")
    public ResponseEntity<LeaderboardResponse> getLeaderboard(@PathVariable Long groupId) {
        return ResponseEntity.ok(coinService.getLeaderboard(groupId));
    }

    /**
     * Finalizes the competition and declares the winner.
     * Relates to US-008.
     *
     * @param groupId the competition group ID
     * @return 200 OK with final leaderboard and declared winner
     */
    @PostMapping("/competitions/{groupId}/finalize")
    public ResponseEntity<LeaderboardResponse> finalizeCompetition(@PathVariable Long groupId) {
        return ResponseEntity.ok(coinService.finalizeCompetition(groupId));
    }

    /**
     * Returns the total coins for a specific user.
     *
     * @param userId the user ID
     * @return 200 OK with total coin balance
     */
    @GetMapping("/coins/users/{userId}/balance")
    public ResponseEntity<Integer> getUserBalance(@PathVariable Long userId) {
        return ResponseEntity.ok(coinService.getTotalCoins(userId));
    }
}
