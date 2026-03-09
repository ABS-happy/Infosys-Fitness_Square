package com.fitnesssquare.controller;

import java.security.Principal;
import java.time.LocalDate;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fitnesssquare.model.User;
import com.fitnesssquare.model.WeightLog;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.repository.WeightLogRepository;
import com.fitnesssquare.service.GoalService;

import jakarta.validation.Valid;
import com.fitnesssquare.dto.WeightLogDTO;
import java.time.format.DateTimeParseException;

@RestController
@RequestMapping("/api/member/weight-log")
@CrossOrigin(origins = "*")
public class WeightLogController {

    @Autowired
    private WeightLogRepository weightLogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalService goalService;

    @GetMapping
    public ResponseEntity<?> getWeightLog(@RequestParam String date, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();

        User user = userRepository.findByEmail(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(404).body("User not found");

        LocalDate logDate;
        try {
            logDate = LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest()
                    .body(java.util.Map.of("message", "Invalid date format. Expected yyyy-MM-dd."));
        }

        Optional<WeightLog> log = weightLogRepository.findByUserAndDate(user, logDate);

        if (log.isPresent()) {
            return ResponseEntity.ok(log.get());
        } else {
            return ResponseEntity.ok(new java.util.HashMap<String, Object>() {
                {
                    put("exists", false);
                }
            });
        }
    }

    @PostMapping
    public ResponseEntity<?> saveWeightLog(@Valid @RequestBody WeightLogDTO payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();

        User user = userRepository.findByEmail(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(404).body("User not found");

        LocalDate logDate;
        try {
            logDate = LocalDate.parse(payload.getDate());
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest()
                    .body(java.util.Map.of("message", "Invalid date format. Expected yyyy-MM-dd."));
        }

        Double weight = payload.getWeight();
        LocalDate today = LocalDate.now();

        // Find or create log
        WeightLog log = weightLogRepository.findByUserAndDate(user, logDate)
                .orElse(new WeightLog());

        log.setUser(user);
        log.setDate(logDate);
        log.setWeight(weight);

        weightLogRepository.save(log);

        // Update user's current weight only if this is today's log exactly
        if (logDate.isEqual(today)) {
            user.setWeight(weight);
            userRepository.save(user);
        }

        // Check for habit goals completion
        try {
            goalService.checkAndAutoComplete(user, "Habit", "weight", weight, logDate);
        } catch (Exception e) {
            System.err.println("Error evaluating weight goals: " + e.getMessage());
        }

        return ResponseEntity.ok(log);
    }
}
