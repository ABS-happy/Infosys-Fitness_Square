package com.fitnesssquare.controller;

import com.fitnesssquare.model.SleepLog;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.SleepLogRepository;
import com.fitnesssquare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/sleep")
@CrossOrigin(origins = "*")
public class SleepLogController {

    @Autowired
    private SleepLogRepository sleepLogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.fitnesssquare.service.GoalService goalService;

    @PostMapping
    public ResponseEntity<?> addSleepLog(@RequestBody java.util.Map<String, Object> payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        LocalDate date = LocalDate.now();
        if (payload.get("sleepDate") != null) {
            date = LocalDate.parse((String) payload.get("sleepDate"));
        }

        // Check if sleep log already exists for this date, if so, update it
        SleepLog existing = sleepLogRepository.findByUserAndSleepDate(user, date).orElse(new SleepLog());
        existing.setUser(user);
        existing.setSleepDate(date);
        // Manual mapping from payload
        if (payload.containsKey("sleepHours")) {
            existing.setSleepHours(parseBigDecimal(payload.get("sleepHours")));
        }
        if (payload.containsKey("notes")) {
            existing.setNotes((String) payload.get("notes"));
        }

        sleepLogRepository.save(existing);

        // Auto-complete goal
        java.util.List<String> completedGoals = new java.util.ArrayList<>();
        try {
            final LocalDate searchDate = date;
            double totalSleepToday = sleepLogRepository.findByUser(user).stream()
                    .filter(s -> s.getSleepDate() != null && s.getSleepDate().equals(searchDate))
                    .map(SleepLog::getSleepHours)
                    .mapToDouble(BigDecimal::doubleValue)
                    .sum();

            completedGoals = goalService.checkAndAutoComplete(user, "Sleep", "Sleep", totalSleepToday, searchDate);
        } catch (Exception e) {
            System.err.println("Error auto-completing goal: " + e.getMessage());
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Sleep log recorded successfully");
        response.put("completedGoals", completedGoals);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteSleepLog(@PathVariable String id, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        SleepLog log = sleepLogRepository.findById(id).orElse(null);
        if (log == null) {
            return ResponseEntity.notFound().build();
        }

        if (!log.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Unauthorized");
        }

        sleepLogRepository.delete(log);

        // Auto-uncheck logic
        try {
            LocalDate targetDate = log.getSleepDate() != null ? log.getSleepDate() : LocalDate.now();
            double totalSleep = sleepLogRepository.findByUser(user).stream()
                    .filter(s -> s.getSleepDate() != null && s.getSleepDate().equals(targetDate))
                    .map(SleepLog::getSleepHours)
                    .mapToDouble(BigDecimal::doubleValue)
                    .sum();

            goalService.checkAndMarkIncomplete(user, "Sleep", totalSleep, "hours", targetDate);
        } catch (Exception e) {
            System.err.println("Error auto-unchecking goal: " + e.getMessage());
        }

        return ResponseEntity.ok("Sleep log deleted");
    }

    private BigDecimal parseBigDecimal(Object value) {
        if (value == null || value.toString().trim().isEmpty()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(value.toString());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    @GetMapping
    public ResponseEntity<List<SleepLog>> getSleepLogs(Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(sleepLogRepository.findByUser(user));
    }
}
