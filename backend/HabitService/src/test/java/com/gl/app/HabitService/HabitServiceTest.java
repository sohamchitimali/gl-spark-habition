package com.gl.app.HabitService;

import com.gl.app.HabitService.client.CoinServiceClient;
import com.gl.app.HabitService.dto.CompleteHabitResponse;
import com.gl.app.HabitService.dto.HeatmapResponse;
import com.gl.app.HabitService.dto.StreakResponse;
import com.gl.app.HabitService.entity.Habit;
import com.gl.app.HabitService.entity.HabitCompletion;
import com.gl.app.HabitService.repository.HabitCompletionRepository;
import com.gl.app.HabitService.repository.HabitRepository;
import com.gl.app.HabitService.repository.HabitTaskRepository;
import com.gl.app.HabitService.service.HabitService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link HabitService} covering US-004, US-005, and US-009 acceptance criteria.
 */
@ExtendWith(MockitoExtension.class)
class HabitServiceTest {

    @Mock
    private HabitRepository habitRepository;

    @Mock
    private HabitCompletionRepository completionRepository;

    @Mock
    private HabitTaskRepository taskRepository;

    @Mock
    private com.gl.app.HabitService.repository.HeatmapRecordRepository heatmapRecordRepository;

    @Mock
    private CoinServiceClient coinServiceClient;

    @InjectMocks
    private HabitService habitService;

    @Test
    @DisplayName("US-004: completeHabit should record completion and credit coins")
    void completeHabit_shouldRecordCompletionAndCreditCoins() {
        // Arrange
        Long habitId = 1L;
        Long userId = 10L;
        Habit habit = new Habit(habitId, "Morning Run", "Run every morning", userId, null, null);

        when(habitRepository.findById(habitId)).thenReturn(Optional.of(habit));
        when(completionRepository.existsByHabitIdAndUserIdAndCompletionDate(habitId, userId, LocalDate.now()))
                .thenReturn(false);
        when(taskRepository.countByHabitIdAndCompleted(habitId, false)).thenReturn(0L);
        when(completionRepository.save(any(HabitCompletion.class))).thenReturn(new HabitCompletion());
        when(habitRepository.findByUserId(userId)).thenReturn(List.of(habit));
        when(completionRepository.countCompletionsByDateForUser(userId))
                .thenReturn(List.<Object[]>of(new Object[]{LocalDate.now(), 1L}));

        // Act
        CompleteHabitResponse response = habitService.completeHabit(habitId, userId);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.getHabitId()).isEqualTo(habitId);
        assertThat(response.getCurrentStreak()).isEqualTo(1);
        assertThat(response.getCoinsEarned()).isEqualTo(1);
        verify(completionRepository, times(1)).save(any(HabitCompletion.class));
        verify(coinServiceClient, times(1)).creditCoins(any());
    }

    @Test
    @DisplayName("US-004: completeHabit should throw 409 when already completed today")
    void completeHabit_alreadyCompletedToday_shouldThrow409() {
        // Arrange
        Long habitId = 1L;
        Long userId = 10L;
        Habit habit = new Habit(habitId, "Morning Run", "Run every morning", userId, null, null);

        when(habitRepository.findById(habitId)).thenReturn(Optional.of(habit));
        when(completionRepository.existsByHabitIdAndUserIdAndCompletionDate(habitId, userId, LocalDate.now()))
                .thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> habitService.completeHabit(habitId, userId))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("already completed today");

        verify(completionRepository, never()).save(any());
        verify(coinServiceClient, never()).creditCoins(any());
    }

    @Test
    @DisplayName("US-009: getStreak should return correct current streak")
    void getStreak_shouldReturnCorrectCurrentStreak() {
        // Arrange
        Long userId = 10L;
        List<LocalDate> dates = List.of(
                LocalDate.now(),
                LocalDate.now().minusDays(1),
                LocalDate.now().minusDays(2)
        );
        Habit mockHabit = new Habit(1L, "Morning Run", "Run every morning", userId, null, null);
        when(habitRepository.findByUserId(userId)).thenReturn(List.of(mockHabit));
        when(completionRepository.countCompletionsByDateForUser(userId)).thenReturn(List.of(
                new Object[]{LocalDate.now(), 1L},
                new Object[]{LocalDate.now().minusDays(1), 1L},
                new Object[]{LocalDate.now().minusDays(2), 1L}
        ));

        // Act
        StreakResponse response = habitService.getStreak(userId);

        // Assert
        assertThat(response.getCurrentStreak()).isEqualTo(3);
        assertThat(response.getUserId()).isEqualTo(userId);
    }

    @Test
    @DisplayName("US-005: getHeatmap should return list of daily completion percentages")
    void getHeatmap_shouldReturnDailyCompletionPercentages() {
        // Arrange
        Long userId = 10L;
        LocalDate today = LocalDate.now();
        when(heatmapRecordRepository.findByUserIdAndGroupIdIsNullOrderByRecordDateDesc(userId))
                .thenReturn(List.of(
                        new com.gl.app.HabitService.entity.HeatmapRecord(1L, userId, null, today, 4, 2, 50),
                        new com.gl.app.HabitService.entity.HeatmapRecord(2L, userId, null, today.minusDays(1), 5, 5, 100)
                ));

        // Act
        HeatmapResponse response = habitService.getHeatmap(userId);

        // Assert
        assertThat(response.getUserId()).isEqualTo(userId);
        assertThat(response.getDays()).hasSize(2);
        assertThat(response.getDays().get(0).getCompletionPercentage()).isEqualTo(50);
    }
}
