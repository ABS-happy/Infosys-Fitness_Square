package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "trainer_messages")
public class TrainerMessage {
    @Id
    private String id;

    @DBRef
    private User trainer;

    @DBRef
    private User member;

    private String content;
    private LocalDateTime timestamp;
    private boolean isRead = false;
}
