package com.fitnesssquare.dto;

import java.time.LocalDateTime;

public class ModerationHistoryDTO {
    private String id;
    private String actionType; // e.g., POST_PUBLISHED, POST_REJECTED, POST_DELETED
    private String targetId;
    private String targetType; // POST or COMMENT
    private String targetSnippet; // Title or content snippet
    private String moderatorName;
    private String moderatorRole;
    private LocalDateTime timestamp;

    public ModerationHistoryDTO() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
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

    public String getTargetSnippet() {
        return targetSnippet;
    }

    public void setTargetSnippet(String targetSnippet) {
        this.targetSnippet = targetSnippet;
    }

    public String getModeratorName() {
        return moderatorName;
    }

    public void setModeratorName(String moderatorName) {
        this.moderatorName = moderatorName;
    }

    public String getModeratorRole() {
        return moderatorRole;
    }

    public void setModeratorRole(String moderatorRole) {
        this.moderatorRole = moderatorRole;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
