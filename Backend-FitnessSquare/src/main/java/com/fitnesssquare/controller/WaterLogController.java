package com.fitnesssquare.controller;

import com.fitnesssquare.model.WaterLog;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.WaterLogRepository;
import com.fitnesssquare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.Principal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/water")
@CrossOrigin(origins = "*")
public class WaterLogController {

    @Autowired
    private WaterLogRepository waterLogRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.fitnesssquare.service.GoalService goalService;

    @PostMapping
    public ResponseEntity<?> addWaterLog(@RequestBody java.util.Map<String, Object> payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        WaterLog waterLog = new WaterLog();
        waterLog.setUser(user);

        // Manual mapping from payload
        if (payload.containsKey("waterIntake")) {
            BigDecimal intake = parseBigDecimal(payload.get("waterIntake"));
            // Normalize ml to L if value is high (e.g. > 50)
            if (intake.doubleValue() > 50) {
                intake = intake.divide(new BigDecimal("1000"), 3, RoundingMode.HALF_UP);
            }
            waterLog.setWaterIntake(intake);
        }
        if (payload.containsKey("notes")) {
            waterLog.setNotes((String) payload.get("notes"));
        }

        LocalDate date = LocalDate.now();
        if (payload.get("logDate") != null) {
            date = LocalDate.parse((String) payload.get("logDate"));
        }
        waterLog.setLogDate(date);

        waterLogRepository.save(waterLog);

        // Auto-complete goal
        java.util.List<String> completedGoals = new java.util.ArrayList<>();
        try {
            // Need total water for today
            final LocalDate finalDate = date; // Create effective final copy
            java.math.BigDecimal totalWater = waterLogRepository.findByUser(user).stream()
                    .filter(l -> l.getLogDate().equals(finalDate))
                    .map(l -> {
                        BigDecimal val = l.getWaterIntake();
                        if (val != null && val.doubleValue() > 50) {
                            return val.divide(new BigDecimal("1000"), 3, RoundingMode.HALF_UP);
                        }
                        return val != null ? val : BigDecimal.ZERO;
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            completedGoals = goalService.checkAndAutoComplete(user, "Habit", "Water", totalWater.doubleValue(),
                    finalDate);
            completedGoals
                    .addAll(goalService.checkAndAutoComplete(user, "Hydration", "Water", totalWater.doubleValue(),
                            finalDate));
        } catch (Exception e) {
            System.err.println("Error auto-completing goal: " + e.getMessage());
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Water intake logged successfully");
        response.put("completedGoals", completedGoals);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<WaterLog>> getWaterLogs(Principal principal,
            @RequestParam(required = false) String date) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<WaterLog> logs = waterLogRepository.findByUser(user);

        if (date != null && !date.isEmpty()) {
            LocalDate targetDate = LocalDate.parse(date);
            logs = logs.stream()
                    .filter(l -> l.getLogDate() != null && l.getLogDate().equals(targetDate))
                    .collect(java.util.stream.Collectors.toList());
        }

        // Normalize to ML for frontend (which expects ml)
        logs.forEach(log -> {
            BigDecimal intake = log.getWaterIntake();
            if (intake != null && intake.doubleValue() < 50 && intake.doubleValue() > 0) {
                log.setWaterIntake(intake.multiply(new BigDecimal("1000")));
            }
        });

        return ResponseEntity.ok(logs);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteWaterLog(@PathVariable String id, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        WaterLog log = waterLogRepository.findById(id).orElse(null);
        if (log == null) {
            return ResponseEntity.notFound().build();
        }

        if (!log.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Unauthorized");
        }

        waterLogRepository.delete(log);

        // Auto-uncheck logic
        try {
            LocalDate targetDate = log.getLogDate() != null ? log.getLogDate() : LocalDate.now();
            double totalWater = waterLogRepository.findByUser(user).stream()
                    .filter(w -> w.getLogDate() != null && w.getLogDate().equals(targetDate))
                    .map(WaterLog::getWaterIntake)
                    .mapToDouble(BigDecimal::doubleValue)
                    .sum();

            // Normalize ml to L if likely ml
            if (totalWater > 50)
                totalWater /= 1000.0;

            goalService.checkAndMarkIncomplete(user, "Habit", totalWater, "L", targetDate);
            goalService.checkAndMarkIncomplete(user, "Hydration", totalWater, "L", targetDate);
        } catch (Exception e) {
            System.err.println("Error auto-unchecking goal: " + e.getMessage());
        }

        return ResponseEntity.ok("Water log deleted");
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateWaterLog(@PathVariable String id, @RequestBody java.util.Map<String, Object> payload,
            Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        WaterLog log = waterLogRepository.findById(id).orElse(null);
        if (log == null) {
            return ResponseEntity.notFound().build();
        }

        if (!log.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        // Manual mapping from payload
        if (payload.containsKey("waterIntake")) {
            BigDecimal intake = parseBigDecimal(payload.get("waterIntake"));
            if (intake.doubleValue() > 50) {
                intake = intake.divide(new BigDecimal("1000"), 3, RoundingMode.HALF_UP);
            }
            log.setWaterIntake(intake);
        }
        if (payload.containsKey("notes")) {
            log.setNotes((String) payload.get("notes"));
        }

        return ResponseEntity.ok(waterLogRepository.save(log));
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
}
