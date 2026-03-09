package com.fitnesssquare.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.security.JwtUtils;

@RestController
@RequestMapping("/api/profile")
@CrossOrigin(origins = "*")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;
    @Autowired
    private com.fitnesssquare.service.TrainerAssignmentService trainerAssignmentService;

    @PutMapping
    public ResponseEntity<?> updateProfile(@RequestHeader("Authorization") String authHeader,
            @RequestBody User updateData) {
        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtils.getEmailFromToken(token);

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        User user = userOpt.get();
        String role = user.getRole();

        if ("trainer".equalsIgnoreCase(role)) {
            // Trainer Specific (Mutable only)
            if (updateData.getBio() != null)
                user.setBio(updateData.getBio());
            if (updateData.getExperience() != null)
                user.setExperience(updateData.getExperience());
            if (updateData.getCertificates() != null)
                user.setCertificates(updateData.getCertificates());
            // Immutable: Fullname, Email, Specialization, Age, Weight, Height, Gender
        } else {
            // Member Specific Common Fields
            user.setAge(updateData.getAge());
            user.setWeight(updateData.getWeight());
            user.setHeight(updateData.getHeight());
            user.setGender(updateData.getGender());

            // Member Specific
            user.setFullname(updateData.getFullname());
            user.setFitnessGoals(updateData.getFitnessGoals());
            user.setPrimaryGoal(updateData.getPrimaryGoal());

            // Targets
            user.setTargetCaloriesBurned(updateData.getTargetCaloriesBurned());
            user.setTargetWaterLiters(updateData.getTargetWaterLiters());
            user.setTargetSleepHours(updateData.getTargetSleepHours());
            user.setMedicalReports(updateData.getMedicalReports());

            // Attempt to assign trainer if member has goals
            trainerAssignmentService.assignTrainerIfNeeded(user, user.getFitnessGoals());
        }

        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Profile updated successfully");
        user.setPassword(null);
        response.put("user", user);

        return ResponseEntity.ok(response);
    }
}
