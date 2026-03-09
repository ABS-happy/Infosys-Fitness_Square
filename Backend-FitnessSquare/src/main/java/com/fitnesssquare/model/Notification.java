package com.fitnesssquare.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;

@Data
@Document(collection = "notifications")
public class Notification {
    @Id
    private String id;

    @DBRef
    private User recipient;

    private String message;
    private String type; // INFO, SUCCESS, WARNING, ERROR, REQUEST
    private boolean isRead = false;
    private LocalDateTime createdAt;

    // Optional: Link to related entity (e.g., request ID)
    private String relatedEntityId;
}
