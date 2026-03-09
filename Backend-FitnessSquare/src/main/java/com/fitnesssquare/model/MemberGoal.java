package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Document(collection = "member_goals")
public class MemberGoal {
    @Id
    private String id;

    @DBRef
    private User member;

    @DBRef
    private User trainer; // Who created this goal

    private String category; // "Workout", "Nutrition", "Sleep", "Habit"
    private String taskDescription;
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean active = true;
    private String planReview;
    private Integer planRating;
    private LocalDateTime createdAt;
}
