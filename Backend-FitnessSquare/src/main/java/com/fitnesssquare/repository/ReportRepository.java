package com.fitnesssquare.repository;

import com.fitnesssquare.model.Report;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReportRepository extends MongoRepository<Report, String> {
    List<Report> findByTargetId(String targetId);

    List<Report> findByStatus(String status);

    boolean existsByReporterIdAndTargetIdAndTargetType(String reporterId, String targetId, String targetType);

    List<Report> findByReporterIdAndTargetType(String reporterId, String targetType);

    List<Report> findByReporterId(String reporterId);

    java.util.Optional<Report> findByReporterIdAndTargetIdAndTargetType(String reporterId, String targetId,
            String targetType);

    void deleteByTargetId(String targetId);
}
