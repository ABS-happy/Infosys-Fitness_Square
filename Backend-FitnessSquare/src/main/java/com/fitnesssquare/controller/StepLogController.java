package com.fitnesssquare.controller;

import com.fitnesssquare.model.StepLog;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.StepLogRepository;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.service.GoalService;
import com.fitnesssquare.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/steps")
public class StepLogController {

    @Autowired
    private StepLogRepository stepLogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GoalService goalService;

    @Autowired
    private JwtUtils jwtUtils;

    @PostMapping
    public ResponseEntity<?> updateSteps(@RequestHeader("Authorization") String token,
            @RequestBody Map<String, Integer> payload) {
        String email = jwtUtils.getEmailFromToken(token.substring(7));
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        if (!payload.containsKey("steps")) {
            return ResponseEntity.badRequest().body("Missing 'steps' field");
        }

        Integer steps = payload.get("steps");
        LocalDate today = LocalDate.now();

        Optional<StepLog> existingLog = stepLogRepository.findByUserAndDate(user, today);
        StepLog log;

        if (existingLog.isPresent()) {
            log = existingLog.get();
            log.setSteps(steps);
        } else {
            log = new StepLog();
            log.setUser(user);
            log.setDate(today);
            log.setSteps(steps);
        }

        stepLogRepository.save(log);

        // Auto-verify goal: "10,000 Steps" (Category: Workout)
        // Also check "General Health" category if applicable
        List<String> completedGoals = goalService.checkAndAutoComplete(user, "Workout", "10,000 Steps", steps, today);

        // Also check "General Health" category goals just in case
        List<String> healthGoals = goalService.checkAndAutoComplete(user, "General Health", "10,000 Steps", steps,
                today);
        completedGoals.addAll(healthGoals);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Steps updated successfully");
        response.put("steps", steps);
        response.put("completedGoals", completedGoals);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/today")
    public ResponseEntity<?> getTodaySteps(@RequestHeader("Authorization") String token) {
        String email = jwtUtils.getEmailFromToken(token.substring(7));
        User user = userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));

        LocalDate today = LocalDate.now();
        Optional<StepLog> log = stepLogRepository.findByUserAndDate(user, today);

        Map<String, Object> response = new HashMap<>();
        response.put("steps", log.map(StepLog::getSteps).orElse(0));

        return ResponseEntity.ok(response);
    }
}
