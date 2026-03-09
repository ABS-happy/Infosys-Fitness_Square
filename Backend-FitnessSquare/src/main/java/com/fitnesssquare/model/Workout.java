package com.fitnesssquare.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DBRef;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "workouts")
public class Workout {
    @Id
    private String id;
    private String exerciseName;
    private String exerciseType; // strength, cardio, etc.
    private int sets;
    private int reps;
    private int weight;
    private int durationMinutes;
    private Integer caloriesBurned;
    private LocalDate workoutDate;

    @DBRef
    private User user;
}
