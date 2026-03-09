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
@Document(collection = "meals")
public class Meal {
    @Id
    private String id;
    private String foodName;
    private String portion;
    private String mealType; // breakfast, lunch, dinner, snacks
    private int calories;
    private Integer protein;
    private Integer carbs;
    private Integer fats;
    private Integer fiber;
    private LocalDate mealDate;
    @com.fasterxml.jackson.annotation.JsonFormat(pattern = "HH:mm")
    private java.time.LocalTime mealTime;

    @DBRef
    private User user;
}
