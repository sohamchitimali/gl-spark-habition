package com.gl.app.CoinService.service;

import com.gl.app.CoinService.dto.CreditCoinsRequest;
import com.gl.app.CoinService.dto.LeaderboardEntry;
import com.gl.app.CoinService.dto.LeaderboardResponse;
import com.gl.app.CoinService.entity.Coin;
import com.gl.app.CoinService.repository.CoinRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

/**
 * Business logic for coin crediting, leaderboard calculation, and competition finalization.
 * Covers US-006 (earn coins), US-007 (leaderboard), and US-008 (competition winner).
 */
@Service
@Slf4j
public class CoinService {

    @Autowired
    private CoinRepository coinRepository;

    /**
     * Credits coins to a user for completing a habit.
     * Called internally by HabitService.
     *
     * @param request the credit request containing userId, amount, reason, and optional groupId
     * @return the saved {@link Coin} transaction record
     */
    public Coin creditCoins(CreditCoinsRequest request) {
        log.info("Crediting {} coins to userId={} reason='{}'", request.getAmount(), request.getUserId(), request.getReason());
        Coin coin = new Coin(null, request.getUserId(), request.getAmount(), request.getReason(), request.getGroupId());
        Coin saved = coinRepository.save(coin);
        log.debug("Saved coin transaction id={}", saved.getId());
        return saved;
    }

    /**
     * Returns the group leaderboard ranked by total coins earned within the group.
     *
     * @param groupId the ID of the group
     * @return a {@link LeaderboardResponse} with ranked entries
     * @throws ResponseStatusException 404 if no data found for group
     */
    public LeaderboardResponse getLeaderboard(Long groupId) {
        log.info("Fetching leaderboard for groupId={}", groupId);
        List<Object[]> raw = coinRepository.findLeaderboardByGroupId(groupId);

        List<LeaderboardEntry> entries = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) {
            Object[] row = raw.get(i);
            Long userId = (Long) row[0];
            Integer totalCoins = ((Number) row[1]).intValue();
            entries.add(new LeaderboardEntry(i + 1, userId, totalCoins));
        }

        Long winnerId = entries.isEmpty() ? null : entries.get(0).getUserId();
        return new LeaderboardResponse(groupId, entries, winnerId);
    }

    /**
     * Finalizes a competition by determining the winner.
     * The winner is the group member with the most coins earned within the group.
     * Ties are not broken in this implementation (future enhancement).
     *
     * @param groupId the ID of the competition group
     * @return the {@link LeaderboardResponse} with the declared winner
     */
    public LeaderboardResponse finalizeCompetition(Long groupId) {
        log.info("Finalizing competition for groupId={}", groupId);
        LeaderboardResponse leaderboard = getLeaderboard(groupId);

        if (leaderboard.getEntries().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No participants found for group");
        }

        Long winnerId = leaderboard.getEntries().get(0).getUserId();
        leaderboard.setWinnerId(winnerId);
        log.info("Winner for groupId={} is userId={}", groupId, winnerId);
        return leaderboard;
    }

    /**
     * Returns the total coins earned by a specific user.
     *
     * @param userId the user ID
     * @return total coins as an integer
     */
    public Integer getTotalCoins(Long userId) {
        return coinRepository.sumCoinsByUserId(userId);
    }
}
