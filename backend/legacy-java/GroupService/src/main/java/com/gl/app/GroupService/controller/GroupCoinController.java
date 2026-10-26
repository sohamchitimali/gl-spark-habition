package com.gl.app.GroupService.controller;

import com.gl.app.GroupService.dto.CreditCoinsRequest;
import com.gl.app.GroupService.dto.LeaderboardResponse;
import com.gl.app.GroupService.entity.Coin;
import com.gl.app.GroupService.service.GroupCoinService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class GroupCoinController {

    private final GroupCoinService groupCoinService;

    @PostMapping("/coins/credit")
    public ResponseEntity<Coin> creditCoins(@RequestBody @Valid CreditCoinsRequest request) {
        return new ResponseEntity<>(groupCoinService.creditCoins(request), HttpStatus.CREATED);
    }

    @GetMapping("/coins/groups/{groupId}/leaderboard")
    public ResponseEntity<LeaderboardResponse> getLeaderboard(@PathVariable Long groupId) {
        return ResponseEntity.ok(groupCoinService.getLeaderboard(groupId));
    }

    @GetMapping("/coins/users/{userId}/balance")
    public ResponseEntity<Integer> getUserBalance(@PathVariable Long userId) {
        return ResponseEntity.ok(groupCoinService.getUserBalance(userId));
    }

    @DeleteMapping("/coins/groups/{groupId}/reset")
    public ResponseEntity<Void> resetGroupCoins(@PathVariable Long groupId) {
        groupCoinService.resetGroupCoins(groupId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/competitions/{groupId}/finalize")
    public ResponseEntity<LeaderboardResponse> finalizeCompetition(@PathVariable Long groupId) {
        return ResponseEntity.ok(groupCoinService.finalizeCompetition(groupId));
    }
}
