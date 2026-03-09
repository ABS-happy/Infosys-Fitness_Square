package com.fitnesssquare.model;

import java.time.LocalDate;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;

@Data
@Document(collection = "weight_logs")
public class WeightLog {
    @Id
    private String id;

    @DBRef
    private User user;

    private LocalDate date;
    private Double weight; // in kg
}
