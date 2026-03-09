package com.fitnesssquare.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "reports")
public class Report {
    @Id
    private String id;
    private String reporterId;
    private String targetId;

    // For backwards compatibility with old reports in the DB before migration
    private String reportedPostId;

    private String targetType; // POST or COMMENT
    private String reason; // Spam, Abusive, Misinformation, Irrelevant
    private String status; // PENDING, REVIEWED
    private LocalDateTime createdAt;

    public Report() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getReporterId() {
        return reporterId;
    }

    public void setReporterId(String reporterId) {
        this.reporterId = reporterId;
    }

    public String getTargetId() {
        if (targetId != null && !targetId.isEmpty()) {
            return targetId;
        }
        return reportedPostId; // Fallback for old records
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public String getReportedPostId() {
        return reportedPostId;
    }

    public void setReportedPostId(String reportedPostId) {
        this.reportedPostId = reportedPostId;
    }

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
