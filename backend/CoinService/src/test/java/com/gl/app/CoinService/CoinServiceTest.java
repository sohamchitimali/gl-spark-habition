package com.gl.app.CoinService;

import com.gl.app.CoinService.dto.CreditCoinsRequest;
import com.gl.app.CoinService.dto.LeaderboardResponse;
import com.gl.app.CoinService.entity.Coin;
import com.gl.app.CoinService.repository.CoinRepository;
import com.gl.app.CoinService.service.CoinService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link CoinService} covering US-006, US-007, and US-008 acceptance criteria.
 */
@ExtendWith(MockitoExtension.class)
class CoinServiceTest {

    @Mock
    private CoinRepository coinRepository;

    @InjectMocks
    private CoinService coinService;

    @Test
    @DisplayName("US-006: creditCoins should save a transaction and return it")
    void creditCoins_shouldSaveCoinTransaction() {
        // Arrange
        CreditCoinsRequest request = new CreditCoinsRequest(1L, 10, "Habit completion", 5L);
        Coin saved = new Coin(1L, 1L, 10, "Habit completion", 5L);
        when(coinRepository.save(any(Coin.class))).thenReturn(saved);

        // Act
        Coin result = coinService.creditCoins(request);

        // Assert
        assertThat(result.getAmount()).isEqualTo(10);
        assertThat(result.getUserId()).isEqualTo(1L);
        verify(coinRepository, times(1)).save(any(Coin.class));
    }

    @Test
    @DisplayName("US-007: getLeaderboard should return ranked entries for a group")
    void getLeaderboard_shouldReturnRankedEntries() {
        // Arrange
        Long groupId = 5L;
        when(coinRepository.findLeaderboardByGroupId(groupId)).thenReturn(List.of(
                new Object[]{2L, 284L},
                new Object[]{1L, 210L},
                new Object[]{3L, 176L}
        ));

        // Act
        LeaderboardResponse response = coinService.getLeaderboard(groupId);

        // Assert
        assertThat(response.getGroupId()).isEqualTo(groupId);
        assertThat(response.getEntries()).hasSize(3);
        assertThat(response.getEntries().get(0).getRank()).isEqualTo(1);
        assertThat(response.getEntries().get(0).getUserId()).isEqualTo(2L);
        assertThat(response.getWinnerId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("US-008: finalizeCompetition should declare winner as top leaderboard user")
    void finalizeCompetition_shouldDeclareWinner() {
        // Arrange
        Long groupId = 5L;
        when(coinRepository.findLeaderboardByGroupId(groupId)).thenReturn(List.of(
                new Object[]{2L, 300L},
                new Object[]{1L, 150L}
        ));

        // Act
        LeaderboardResponse response = coinService.finalizeCompetition(groupId);

        // Assert
        assertThat(response.getWinnerId()).isEqualTo(2L);
        assertThat(response.getEntries().get(0).getTotalCoins()).isEqualTo(300);
    }

    @Test
    @DisplayName("US-008: finalizeCompetition with empty group should throw 404")
    void finalizeCompetition_emptyGroup_shouldThrow404() {
        // Arrange
        Long groupId = 99L;
        when(coinRepository.findLeaderboardByGroupId(groupId)).thenReturn(List.of());

        // Act & Assert
        assertThatThrownBy(() -> coinService.finalizeCompetition(groupId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("No participants found");
    }
}
