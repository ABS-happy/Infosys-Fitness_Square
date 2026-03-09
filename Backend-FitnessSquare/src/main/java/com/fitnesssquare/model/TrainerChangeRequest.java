package com.fitnesssquare.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;

@Data
@Document(collection = "trainer_change_requests")
public class TrainerChangeRequest {
    @Id
    private String id;

    @DBRef
    private User member;

    @DBRef
    private User currentTrainer;

    @DBRef
    private User requestedTrainer;

    private String status; // PENDING, APPROVED, REJECTED
    private String reason; // Optional: Reason for change

    private LocalDateTime requestDate;
    private LocalDateTime responseDate;
}
