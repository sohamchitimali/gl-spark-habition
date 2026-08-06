package com.gl.app.HabitService.repository;

import com.gl.app.HabitService.entity.HeatmapRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HeatmapRecordRepository extends JpaRepository<HeatmapRecord, Long> {

    Optional<HeatmapRecord> findByUserIdAndGroupIdIsNullAndRecordDate(Long userId, LocalDate recordDate);

    Optional<HeatmapRecord> findByGroupIdAndUserIdIsNullAndRecordDate(Long groupId, LocalDate recordDate);

    List<HeatmapRecord> findByUserIdAndGroupIdIsNullOrderByRecordDateDesc(Long userId);

    List<HeatmapRecord> findByGroupIdAndUserIdIsNullOrderByRecordDateDesc(Long groupId);
}
