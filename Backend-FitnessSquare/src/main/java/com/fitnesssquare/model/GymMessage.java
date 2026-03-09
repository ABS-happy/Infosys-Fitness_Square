package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "gym_messages")
public class GymMessage {
    @Id
    private String id;

    @DBRef
    private User trainer;

    private String sender; // Admin, Management
    private String content;
    private LocalDateTime timestamp;
    private boolean isRead = false;
}
