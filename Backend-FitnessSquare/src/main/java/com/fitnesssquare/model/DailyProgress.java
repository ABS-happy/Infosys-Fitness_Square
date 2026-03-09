package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Document(collection = "daily_progress")
public class DailyProgress {
    @Id
    private String id;

    @DBRef
    private User member;

    @DBRef
    private MemberGoal goal;

    private LocalDate date;
    private boolean completed;
    private LocalDateTime completedAt;
}
