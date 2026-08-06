package com.gl.app.CoinService.repository;

import com.gl.app.CoinService.entity.Coin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

/**
 * Spring Data repository for {@link Coin} transactions.
 */
public interface CoinRepository extends JpaRepository<Coin, Long> {

    /**
     * Returns the total coins earned by a user across all groups and personal habits.
     *
     * @param userId the user ID
     * @return sum of all coin amounts; null if no transactions exist
     */
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Coin c WHERE c.userId = :userId")
    Integer sumCoinsByUserId(@Param("userId") Long userId);

    /**
     * Returns coin totals per user for a specific group, ordered descending.
     * Used to build the group leaderboard.
     *
     * @param groupId the group ID
     * @return list of [userId, totalCoins] pairs ordered by totalCoins descending
     */
    @Query("SELECT c.userId, SUM(c.amount) FROM Coin c WHERE c.groupId = :groupId GROUP BY c.userId ORDER BY SUM(c.amount) DESC")
    List<Object[]> findLeaderboardByGroupId(@Param("groupId") Long groupId);

    /**
     * Returns the total coins earned by a specific user within a specific group.
     *
     * @param userId  the user ID
     * @param groupId the group ID
     * @return total coins; 0 if none
     */
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Coin c WHERE c.userId = :userId AND c.groupId = :groupId")
    Integer sumCoinsByUserIdAndGroupId(@Param("userId") Long userId, @Param("groupId") Long groupId);

    /**
     * Deletes all coin transactions for a given group.
     * Used to reset the group leaderboard.
     *
     * @param groupId the group ID
     */
    void deleteByGroupId(Long groupId);
}
