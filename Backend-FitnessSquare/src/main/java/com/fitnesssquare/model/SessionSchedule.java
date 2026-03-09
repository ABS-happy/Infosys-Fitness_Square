package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "session_schedules")
public class SessionSchedule {
    @Id
    private String id;

    @DBRef
    private User trainer;

    @DBRef
    private User user;

    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String type; // ONLINE, OFFLINE
    private String meetingLink; // For ONLINE sessions
    private String notes;
    private String status; // SCHEDULED, COMPLETED, CANCELLED
    private java.util.List<String> joinedMemberIds = new java.util.ArrayList<>();
}
