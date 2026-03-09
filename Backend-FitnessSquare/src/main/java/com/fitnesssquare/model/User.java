package com.fitnesssquare.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.Data;

@Data
@Document(collection = "users")
@CompoundIndex(name = "email_role_idx", def = "{'email': 1, 'role': 1}", unique = true)
public class User {
    @Id
    private String id;
    private String fullname;
    private String email;
    private String password;
    private String role; // admin, member, trainer

    private Integer age;
    private Double weight;
    private Double height;
    private java.util.List<String> fitnessGoals;
    private String primaryGoal;
    private String gender; // male, female, other

    // 🔒 Trainer-only fields
    private String specialization;
    private String experience;
    private java.util.List<String> certificates;
    private String bio;

    @DBRef
    private User trainer; // Assigned trainer for members

    // For Trainers: Track number of assigned members for load balancing
    private Integer assignedMembersCount = 0;

    // 🔒 User-only targets
    private Double targetCaloriesBurned = 2000.0;
    private Double targetSleepHours = 7.0;
    private Double targetWaterLiters = 6.0;
    private Double targetMealCalories = 1000.0;
    private java.util.List<String> medicalReports;
    private String medicalReportUrl;
    private String medicalReportFilename;

    private java.util.List<String> savedPosts = new java.util.ArrayList<>();

    private boolean emailVerified;
    private boolean active = true;
    private boolean hasLoggedIn = false;
    private boolean usernameSet = true;
}
