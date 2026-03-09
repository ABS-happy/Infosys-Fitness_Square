package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Document(collection = "daily_activity")
public class DailyActivity {
    @Id
    private String id;

    @DBRef
    private User member;

    private LocalDate date;
    private Double caloriesBurned;
    private Double waterLiters;
    private Double sleepHours;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
}
