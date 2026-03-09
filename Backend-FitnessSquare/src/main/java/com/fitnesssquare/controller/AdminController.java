package com.fitnesssquare.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.MealRepository;
import com.fitnesssquare.repository.SleepLogRepository;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.repository.WaterLogRepository;
import com.fitnesssquare.repository.WorkoutRepository;
import com.fitnesssquare.security.JwtUtils;
import com.fitnesssquare.service.TrainerAssignmentService;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private TrainerAssignmentService trainerAssignmentService;

    @Autowired
    private WorkoutRepository workoutRepository;
    @Autowired
    private MealRepository mealRepository;
    @Autowired
    private WaterLogRepository waterLogRepository;

    @Autowired
    private SleepLogRepository sleepLogRepository;

    @Autowired
    private com.fitnesssquare.service.TrainerChangeRequestService trainerChangeRequestService;

    // List all users
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers(@RequestHeader("Authorization") String authHeader) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        java.time.LocalDate today = java.time.LocalDate.now();
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> userModels = users.stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            u.setPassword(null);

            // Map common fields to ensure they are available in the JSON response
            map.put("id", u.getId());
            map.put("fullname", u.getFullname());
            map.put("email", u.getEmail());
            map.put("role", u.getRole());
            map.put("active", u.isActive());
            map.put("hasLoggedIn", u.isHasLoggedIn());
            map.put("age", u.getAge());
            map.put("fitnessGoals", u.getFitnessGoals());
            map.put("trainer", u.getTrainer());
            map.put("experience", u.getExperience());
            map.put("specialization", u.getSpecialization());

            if ("trainer".equals(u.getRole())) {
                map.put("assignedMembersCount", (int) userRepository.countByTrainer(u));
            } else if ("member".equals(u.getRole())) {
                boolean isDailyActive = workoutRepository.existsByUserAndWorkoutDate(u, today) ||
                        mealRepository.existsByUserAndMealDate(u, today) ||
                        waterLogRepository.existsByUserAndLogDate(u, today) ||
                        sleepLogRepository.existsByUserAndSleepDate(u, today);
                map.put("isDailyActive", isDailyActive);
            }
            return map;
        }).collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(userModels);
    }

    // Get user by ID
    @GetMapping("/users/{id}")
    public ResponseEntity<?> getUserById(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        User user = userOpt.get();
        user.setPassword(null);
        return ResponseEntity.ok(user);
    }

    // Delete user
    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        if (!userRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        userRepository.deleteById(id);

        Map<String, String> response = new HashMap<>();
        response.put("message", "User deleted successfully");
        return ResponseEntity.ok(response);
    }

    // Update user role
    @PutMapping("/users/{id}/role")
    public ResponseEntity<?> updateUserRole(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        String newRole = body.get("role");
        if (newRole == null || (!newRole.equals("admin") && !newRole.equals("trainer") && !newRole.equals("member"))) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Invalid role. Must be admin, trainer, or member.");
        }

        User user = userOpt.get();
        user.setRole(newRole);
        userRepository.save(user);

        user.setPassword(null);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "User role updated successfully");
        response.put("user", user);
        return ResponseEntity.ok(response);
    }

    // Get dashboard stats
    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestHeader("Authorization") String authHeader) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        List<User> users = userRepository.findAll();
        long totalUsers = users.size();
        long adminCount = users.stream().filter(u -> "admin".equals(u.getRole())).count();
        long trainerCount = users.stream().filter(u -> "trainer".equals(u.getRole())).count();
        long memberCount = users.stream().filter(u -> "member".equals(u.getRole())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", totalUsers);
        stats.put("adminCount", adminCount);
        stats.put("trainerCount", trainerCount);
        stats.put("memberCount", memberCount);

        return ResponseEntity.ok(stats);
    }

    // Get all trainers
    @GetMapping("/trainers")
    public ResponseEntity<?> getTrainers(@RequestHeader("Authorization") String authHeader) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }
        List<User> trainers = userRepository.findByRole("trainer");
        trainers.forEach(t -> t.setAssignedMembersCount((int) userRepository.countByTrainer(t)));
        return ResponseEntity.ok(trainers);
    }

    // Get all trainers with their assigned users
    @GetMapping("/trainers-detailed")
    public ResponseEntity<?> getTrainersDetailed(@RequestHeader("Authorization") String authHeader) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        List<User> trainers = userRepository.findByRole("trainer");
        List<Map<String, Object>> trainerList = trainers.stream().map(trainer -> {
            Map<String, Object> map = new HashMap<>();
            map.put("trainer", trainer);
            map.put("users", userRepository.findByTrainer(trainer));
            return map;
        }).collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(trainerList);
    }

    // Auto-assign trainer
    @PutMapping("/users/{id}/auto-assign-trainer")
    public ResponseEntity<?> autoAssignTrainer(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getTrainer() != null) {
            Map<String, String> response = new HashMap<>();
            response.put("message", "User already has an assigned trainer");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        trainerAssignmentService.assignTrainerIfNeeded(user, user.getFitnessGoals());

        if (user.getTrainer() == null) {
            Map<String, String> response = new HashMap<>();
            response.put("message", "No trainer available for this fitness goal");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "Trainer assigned automatically");
        return ResponseEntity.ok(response);
    }

    // Toggle user status (active/deactive)
    @PutMapping("/users/{id}/status")
    public ResponseEntity<?> updateUserStatus(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id,
            @RequestBody Map<String, Boolean> body) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }

        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (body.containsKey("active")) {
            user.setActive(body.get("active"));
            userRepository.save(user);
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "User status updated successfully");
        return ResponseEntity.ok(response);
    }

    // Get pending trainer change requests
    @GetMapping("/requests")
    public ResponseEntity<?> getPendingRequests(@RequestHeader("Authorization") String authHeader) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }
        return ResponseEntity.ok(trainerChangeRequestService.getPendingRequests());
    }

    // Approve trainer change request
    @PutMapping("/requests/{id}/approve")
    public ResponseEntity<?> approveRequest(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }
        try {
            trainerChangeRequestService.approveRequest(id);
            return ResponseEntity.ok(Map.of("message", "Request approved successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Reject trainer change request
    @PutMapping("/requests/{id}/reject")
    public ResponseEntity<?> rejectRequest(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        if (!isAdmin(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Admin role required.");
        }
        try {
            trainerChangeRequestService.rejectRequest(id);
            return ResponseEntity.ok(Map.of("message", "Request rejected successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private boolean isAdmin(String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String role = (String) jwtUtils.getClaims(token).get("role");
            return "admin".equals(role);
        } catch (Exception e) {
            return false;
        }
    }
}
