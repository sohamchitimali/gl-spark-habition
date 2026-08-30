package com.gl.app.GroupService.service;

import com.gl.app.GroupService.dto.CreditCoinsRequest;
import com.gl.app.GroupService.dto.LeaderboardEntry;
import com.gl.app.GroupService.dto.LeaderboardResponse;
import com.gl.app.GroupService.entity.Coin;
import com.gl.app.GroupService.repository.CoinRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroupCoinService {

    private final CoinRepository coinRepository;

    @Transactional
    public Coin creditCoins(CreditCoinsRequest request) {
        log.info("Crediting {} coins to userId={} reason='{}'", request.getAmount(), request.getUserId(), request.getReason());
        Coin coin = new Coin(null, request.getUserId(), request.getAmount(), request.getReason(), request.getGroupId());
        return coinRepository.save(coin);
    }

    public LeaderboardResponse getLeaderboard(Long groupId) {
        log.info("Fetching leaderboard for groupId={}", groupId);
        List<Object[]> raw = coinRepository.findLeaderboardByGroupId(groupId);

        List<LeaderboardEntry> entries = new ArrayList<>();
        int currentRank = 1;
        int previousCoins = -1;
        for (int i = 0; i < raw.size(); i++) {
            Object[] row = raw.get(i);
            Long userId = (Long) row[0];
            Integer totalCoins = ((Number) row[1]).intValue();
            if (i > 0 && totalCoins < previousCoins) {
                currentRank = i + 1;
            }
            previousCoins = totalCoins;
            entries.add(new LeaderboardEntry(currentRank, null, userId, totalCoins));
        }

        Long winnerId = entries.isEmpty() ? null : entries.get(0).getUserId();
        return new LeaderboardResponse(groupId, entries, winnerId);
    }

    @Transactional
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

    public Integer getUserBalance(Long userId) {
        Integer total = coinRepository.sumCoinsByUserId(userId);
        return total != null ? total : 0;
    }

    @Transactional
    public void resetGroupCoins(Long groupId) {
        log.info("Resetting coins for groupId={}", groupId);
        coinRepository.deleteByGroupId(groupId);
    }
}
