package com.gl.app.NotificationService.service;

import com.gl.app.NotificationService.entity.LeaderboardSnapshot;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RankRecalculationService {

    /**
     * Patches the user's live score into the snapshot and mathematically recalculates
     * all ranks before passing this data to the LLM.
     * This strictly adheres to the "Own Stat" hallucination trap prevention rule.
     *
     * @param snapshot     The stale snapshot of all users in the group
     * @param targetUserId The user whose score needs patching
     * @param liveScore    The user's current live score
     * @return A mathematically sound, recalculated list of LeaderboardSnapshots
     */
    public List<LeaderboardSnapshot> patchAndRecalculate(List<LeaderboardSnapshot> snapshot, String targetUserId, int liveScore) {
        // 1. Patch the score
        for (LeaderboardSnapshot entry : snapshot) {
            if (entry.getUserId().equals(targetUserId)) {
                entry.setScore(liveScore);
                break;
            }
        }

        // 2. Sort descending by score
        List<LeaderboardSnapshot> sorted = snapshot.stream()
                .sorted(Comparator.comparingInt(LeaderboardSnapshot::getScore).reversed())
                .collect(Collectors.toList());

        // 3. Recalculate ranks (handling ties properly if needed, here simplified to 1-based index)
        int currentRank = 1;
        for (int i = 0; i < sorted.size(); i++) {
            if (i > 0 && sorted.get(i).getScore() < sorted.get(i - 1).getScore()) {
                currentRank = i + 1;
            }
            sorted.get(i).setRank(currentRank);
        }

        return sorted;
    }
}

