package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Document(collection = "daily_goal_summaries")
public class DailyGoalSummary {
    @Id
    private String id;

    @DBRef
    private User user;

    private LocalDate date;

    // Percentages (0.0 to 100.0)
    private Double weightProgress;
    private Double exerciseAdherence;
    private Double habitScore;

    private LocalDateTime updatedAt;

    // Helper text for descriptive display if needed
    private String exerciseText;
}
