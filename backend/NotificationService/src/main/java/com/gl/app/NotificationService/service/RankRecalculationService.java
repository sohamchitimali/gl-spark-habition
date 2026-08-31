package com.gl.app.NotificationService.service;

import com.gl.app.NotificationService.entity.LeaderboardSnapshot;
import com.gl.app.NotificationService.repository.LeaderboardSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RankRecalculationService {

    private final LeaderboardSnapshotRepository repository;

    public LeaderboardSnapshot patchUserRank(LeaderboardSnapshot myEntry, int liveScore) {
        if (myEntry != null) {
            myEntry.setScore(liveScore);
            Integer newRank = repository.calculateLiveRank(myEntry.getGroupId(), liveScore);
            myEntry.setRank(newRank != null ? newRank : 1);
        }
        return myEntry;
    }
}

