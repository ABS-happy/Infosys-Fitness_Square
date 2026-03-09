package com.fitnesssquare.dto;

import java.time.LocalDateTime;

public class ReportDTO {
    private String id;
    private String targetId;
    private String targetType;
    private String reason;
    private LocalDateTime createdAt;

    private String reporterName;
    private String reporterEmail;

    private String targetContentSnippet;
    private String targetAuthorName;

    public ReportDTO() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getReporterName() {
        return reporterName;
    }

    public void setReporterName(String reporterName) {
        this.reporterName = reporterName;
    }

    public String getReporterEmail() {
        return reporterEmail;
    }

    public void setReporterEmail(String reporterEmail) {
        this.reporterEmail = reporterEmail;
    }

    public String getTargetContentSnippet() {
        return targetContentSnippet;
    }

    public void setTargetContentSnippet(String targetContentSnippet) {
        this.targetContentSnippet = targetContentSnippet;
    }

    public String getTargetAuthorName() {
        return targetAuthorName;
    }

    public void setTargetAuthorName(String targetAuthorName) {
        this.targetAuthorName = targetAuthorName;
    }
}
