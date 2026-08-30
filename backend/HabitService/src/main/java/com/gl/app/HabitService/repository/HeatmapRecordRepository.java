package com.gl.app.HabitService.repository;

import com.gl.app.HabitService.entity.HeatmapRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HeatmapRecordRepository extends JpaRepository<HeatmapRecord, Long> {

    Optional<HeatmapRecord> findByUserIdAndGroupIdIsNullAndRecordDate(Long userId, LocalDate recordDate);

    Optional<HeatmapRecord> findByGroupIdAndUserIdIsNullAndRecordDate(Long groupId, LocalDate recordDate);

    List<HeatmapRecord> findByUserIdAndGroupIdIsNullOrderByRecordDateDesc(Long userId);

    List<HeatmapRecord> findByGroupIdAndUserIdIsNullOrderByRecordDateDesc(Long groupId);

    @Query("SELECT COALESCE(AVG(h.completionPercentage), 0.0) FROM HeatmapRecord h WHERE h.userId = :userId AND h.groupId IS NULL")
    Double getPersonalOverallConsistency(@Param("userId") Long userId);

    @Query("SELECT COALESCE(AVG(h.completionPercentage), 0.0) FROM HeatmapRecord h WHERE h.groupId = :groupId AND h.userId IS NULL")
    Double getGroupOverallConsistency(@Param("groupId") Long groupId);

    @Query("SELECT COALESCE(AVG(h.completionPercentage), 0.0) FROM HeatmapRecord h WHERE h.groupId = :groupId AND h.userId = :userId")
    Double getIndividualGroupConsistency(@Param("groupId") Long groupId, @Param("userId") Long userId);
}
