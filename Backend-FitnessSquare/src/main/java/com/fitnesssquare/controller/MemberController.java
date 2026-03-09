package com.fitnesssquare.controller;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fitnesssquare.model.Meal;
import com.fitnesssquare.model.SleepLog;
import com.fitnesssquare.model.TrainerFeedback;
import com.fitnesssquare.model.TrainerMessage;
import com.fitnesssquare.model.User;
import com.fitnesssquare.model.WaterLog;
import com.fitnesssquare.model.Workout;

import com.fitnesssquare.repository.MealRepository;
import com.fitnesssquare.repository.SessionScheduleRepository;
import com.fitnesssquare.repository.SleepLogRepository;
import com.fitnesssquare.repository.TrainerFeedbackRepository;
import com.fitnesssquare.repository.TrainerMessageRepository;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.repository.WaterLogRepository;
import com.fitnesssquare.repository.WorkoutRepository;
import com.fitnesssquare.security.JwtUtils;

@RestController
@RequestMapping("/api/member")
@CrossOrigin(origins = "*")
public class MemberController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private MealRepository mealRepository;

    @Autowired
    private WorkoutRepository workoutRepository;
    @Autowired
    private WaterLogRepository waterLogRepository;
    @Autowired
    private SleepLogRepository sleepLogRepository;

    @Autowired
    private TrainerFeedbackRepository trainerFeedbackRepository;

    @Autowired
    private TrainerMessageRepository trainerMessageRepository;

    @Autowired
    private SessionScheduleRepository sessionScheduleRepository;

    @Autowired
    private com.fitnesssquare.service.TrainerAssignmentService trainerAssignmentService;

    @Autowired
    private com.fitnesssquare.service.TrainerChangeRequestService trainerChangeRequestService;

    @Autowired
    private com.fitnesssquare.service.NotificationService notificationService;

    @Autowired
    private com.fitnesssquare.service.GoalService goalService;

    @Autowired
    private com.fitnesssquare.service.GoalEffectivenessService goalEffectivenessService;

    @Autowired
    private com.fitnesssquare.repository.DailyProgressRepository dailyProgressRepository;

    @GetMapping("/goal-effectiveness")
    public ResponseEntity<?> getGoalEffectiveness(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        if (member == null)
            return ResponseEntity.status(401).build();

        Map<String, Object> effectiveness = goalEffectivenessService.calculatePlanEffectiveness(member);
        return ResponseEntity.ok(effectiveness);
    }

    @GetMapping("/goal-completion-calendar")
    public ResponseEntity<?> getGoalCompletionCalendar(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        if (member == null)
            return ResponseEntity.status(401).build();

        // Get active goals to determine plan date range
        List<com.fitnesssquare.model.MemberGoal> activeGoals = goalService.getActiveGoalsForMember(member);

        if (activeGoals.isEmpty()) {
            Map<String, Object> emptyResult = new HashMap<>();
            emptyResult.put("hasActivePlan", false);
            return ResponseEntity.ok(emptyResult);
        }

        // Find earliest startDate and latest endDate
        LocalDate earliestStart = activeGoals.stream()
                .map(com.fitnesssquare.model.MemberGoal::getStartDate)
                .filter(date -> date != null)
                .min(LocalDate::compareTo)
                .orElse(LocalDate.now().minusMonths(1));

        LocalDate latestEnd = activeGoals.stream()
                .map(com.fitnesssquare.model.MemberGoal::getEndDate)
                .filter(date -> date != null)
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now().plusMonths(1));

        // Fetch all progress records within the plan range
        List<com.fitnesssquare.model.DailyProgress> progressRecords = dailyProgressRepository
                .findByMemberAndDateBetween(member, earliestStart, latestEnd);

        // Group by date and check if any goal was completed on each date
        Map<String, Boolean> completions = new HashMap<>();
        for (LocalDate date = earliestStart; !date.isAfter(latestEnd); date = date.plusDays(1)) {
            final LocalDate currentDate = date;
            boolean hasCompletion = progressRecords.stream()
                    .anyMatch(p -> p.getDate().equals(currentDate) && p.isCompleted());
            completions.put(date.toString(), hasCompletion);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("hasActivePlan", true);
        result.put("startDate", earliestStart.toString());
        result.put("endDate", latestEnd.toString());
        result.put("completions", completions);

        return ResponseEntity.ok(result);
    }

    @GetMapping("/goals")
    public ResponseEntity<?> getGoals(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String date) {
        User member = getAuthenticatedUser(authHeader);
        if (member == null)
            return ResponseEntity.status(401).build();

        // If no date is provided, return goals grouped by category (Old behavior)
        if (date == null || date.isEmpty()) {
            Map<String, List<com.fitnesssquare.model.MemberGoal>> goalsByCategory = goalService
                    .getGoalsByCategory(member);
            return ResponseEntity.ok(goalsByCategory);
        }

        // If date is provided, return goals for that specific date with status (New
        // behavior)
        LocalDate targetDate;
        try {
            targetDate = LocalDate.parse(date);
        } catch (Exception e) {
            targetDate = LocalDate.now();
        }

        // Get active goals for the date
        List<com.fitnesssquare.model.MemberGoal> goals = goalService.getActiveGoalsForMember(member, targetDate);

        // Get completion status for each goal
        List<Map<String, Object>> goalsWithStatus = new ArrayList<>();
        for (com.fitnesssquare.model.MemberGoal goal : goals) {
            Map<String, Object> goalData = new HashMap<>();
            goalData.put("id", goal.getId());
            goalData.put("category", goal.getCategory());
            goalData.put("taskDescription", goal.getTaskDescription());
            goalData.put("startDate", goal.getStartDate() != null ? goal.getStartDate().toString() : null);
            goalData.put("endDate", goal.getEndDate() != null ? goal.getEndDate().toString() : null);

            // Check if completed on target date
            Optional<com.fitnesssquare.model.DailyProgress> progress = dailyProgressRepository
                    .findByMemberAndGoalAndDate(member, goal, targetDate);
            goalData.put("completed", progress.isPresent() && progress.get().isCompleted());
            goalData.put("progressId", progress.isPresent() ? progress.get().getId() : null);

            goalsWithStatus.add(goalData);
        }

        return ResponseEntity.ok(goalsWithStatus);
    }

    @GetMapping("/upcoming-sessions")
    public ResponseEntity<?> getUpcomingSessions(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        List<com.fitnesssquare.model.SessionSchedule> sessions = sessionScheduleRepository.findByUser(member);
        if (member.getTrainer() != null) {
            sessions.addAll(sessionScheduleRepository.findByTrainerAndUserIsNull(member.getTrainer()));
        }
        return ResponseEntity.ok(sessions);
    }

    @PostMapping("/sessions/{id}/join")
    public ResponseEntity<?> joinSession(@RequestHeader("Authorization") String authHeader, @PathVariable String id) {
        if (!isMember(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied.");
        }
        User member = getAuthenticatedUser(authHeader);
        com.fitnesssquare.model.SessionSchedule session = sessionScheduleRepository.findById(id).orElse(null);

        if (session == null) {
            return ResponseEntity.badRequest().body("Session not found.");
        }

        // Check if session belongs to user OR is a broadcast session from their trainer
        boolean isPrivate = session.getUser() != null && session.getUser().getId().equals(member.getId());
        boolean isBroadcast = session.getUser() == null && member.getTrainer() != null &&
                session.getTrainer().getId().equals(member.getTrainer().getId());

        if (!isPrivate && !isBroadcast) {
            return ResponseEntity.badRequest().body("Session not assigned to you.");
        }

        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        if (now.isBefore(session.getStartTime()) || now.isAfter(session.getEndTime())) {
            return ResponseEntity.badRequest().body("You can only join during the scheduled time window.");
        }

        if (isPrivate) {
            session.setStatus("COMPLETED");
        } else {
            // For broadcast sessions, add user to joined list
            if (!session.getJoinedMemberIds().contains(member.getId())) {
                session.getJoinedMemberIds().add(member.getId());
            }
        }
        sessionScheduleRepository.save(session);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Attendance recorded");
        response.put("link", session.getMeetingLink());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/notifications")
    public ResponseEntity<?> getNotifications(@RequestHeader("Authorization") String authHeader) {
        User user = getAuthenticatedUser(authHeader);
        // Allow both member and admin

        Map<String, Object> notifications = new HashMap<>();

        if ("member".equals(user.getRole())) {
            List<com.fitnesssquare.model.SessionSchedule> sessions = sessionScheduleRepository.findByUser(user);
            if (user.getTrainer() != null) {
                sessions.addAll(sessionScheduleRepository.findByTrainerAndUserIsNull(user.getTrainer()));
                // Filter messages: Only from current trainer
                notifications.put("messages",
                        trainerMessageRepository.findByTrainerAndMemberOrderByTimestampDesc(user.getTrainer(), user));
            } else {
                notifications.put("messages", java.util.Collections.emptyList());
            }
            notifications.put("sessions", sessions);
        }

        notifications.put("systemNotifications", notificationService.getUserNotifications(user));

        return ResponseEntity.ok(notifications);
    }

    @PostMapping("/notifications/{id}/read")
    public ResponseEntity<?> markNotificationRead(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        // Allow all authenticated users (member, trainer, admin)
        getAuthenticatedUser(authHeader);

        notificationService.markAsRead(id);
        return ResponseEntity.ok(Map.of("message", "Notification marked as read"));
    }

    @PostMapping("/notifications/read-all")
    public ResponseEntity<?> markAllNotificationsRead(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        notificationService.markAllAsRead(member);
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read"));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/notifications/{id}")
    public ResponseEntity<?> deleteNotification(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        getAuthenticatedUser(authHeader); // Verify auth
        notificationService.deleteNotification(id);
        return ResponseEntity.ok(Map.of("message", "Notification deleted"));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/messages/{id}")
    public ResponseEntity<?> deleteMessage(@RequestHeader("Authorization") String authHeader,
            @PathVariable String id) {
        getAuthenticatedUser(authHeader); // Verify auth
        trainerMessageRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Message deleted"));
    }

    @PutMapping("/messages/mark-read")
    public ResponseEntity<?> markMessagesRead(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        List<TrainerMessage> messages = trainerMessageRepository.findByMemberOrderByTimestampDesc(member);
        messages.forEach(m -> m.setRead(true));
        trainerMessageRepository.saveAll(messages);
        return ResponseEntity.ok(Map.of("message", "All messages marked as read"));
    }

    // Get Member Profile
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        if (!isMember(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Member role required.");
        }

        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtils.getEmailFromToken(token);
        String role = (String) jwtUtils.getClaims(token).get("role");

        User member = userRepository.findByEmailAndRole(email, role).orElse(null);
        if (member == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Member not found");
        }

        member.setPassword(null); // Security: Don't send password
        return ResponseEntity.ok(member);
    }

    // Update member profile
    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestHeader("Authorization") String authHeader,
            @RequestBody User updateData) {
        if (!isMember(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Member role required.");
        }

        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtils.getEmailFromToken(token);
        String role = (String) jwtUtils.getClaims(token).get("role");

        User member = userRepository.findByEmailAndRole(email, role).orElse(null);
        if (member == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Member not found");
        }

        if (updateData.getFullname() != null && !updateData.getFullname().isEmpty()) {
            member.setFullname(updateData.getFullname());
        }
        member.setAge(updateData.getAge());
        member.setWeight(updateData.getWeight());
        member.setHeight(updateData.getHeight());
        member.setFitnessGoals(updateData.getFitnessGoals());
        member.setPrimaryGoal(updateData.getPrimaryGoal()); // ADDED
        member.setGender(updateData.getGender());
        member.setMedicalReports(updateData.getMedicalReports());

        if (updateData.getTargetCaloriesBurned() != null)
            member.setTargetCaloriesBurned(updateData.getTargetCaloriesBurned());
        if (updateData.getTargetSleepHours() != null)
            member.setTargetSleepHours(updateData.getTargetSleepHours());
        if (updateData.getTargetWaterLiters() != null)
            member.setTargetWaterLiters(updateData.getTargetWaterLiters());
        if (updateData.getTargetMealCalories() != null)
            member.setTargetMealCalories(updateData.getTargetMealCalories());

        // REMOVED: Auto-assignment logic
        // trainerAssignmentService.assignTrainerIfNeeded(member,
        // member.getFitnessGoals());

        userRepository.save(member);

        // REMOVED: Automatic default goal assignment
        // goalService.assignDefaultGoals(member);

        member.setPassword(null);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "Profile updated successfully");
        response.put("user", member);
        return ResponseEntity.ok(response);
    }

    // List All Trainers for Discovery
    @GetMapping("/trainers")
    public ResponseEntity<?> getAllTrainers(@RequestHeader("Authorization") String authHeader) {
        if (!isMember(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Member role required.");
        }

        List<User> trainers = userRepository.findAll().stream()
                .filter(u -> "trainer".equalsIgnoreCase(u.getRole()))
                .collect(Collectors.toList());

        List<Map<String, Object>> trainerDtos = trainers.stream().map(t -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", t.getId());
            dto.put("fullname", t.getFullname());
            dto.put("specialization", t.getSpecialization());
            dto.put("experience", t.getExperience());
            dto.put("bio", t.getBio());
            dto.put("certificates", t.getCertificates());
            dto.put("email", t.getEmail());
            // Calculate current load if needed, but keeping it simple for now
            return dto;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(trainerDtos);
    }

    // Manual Trainer Assignment / Change Request
    @PostMapping("/assign-trainer")
    public ResponseEntity<?> assignTrainer(@RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, String> body) {

        if (!isMember(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Access denied. Member role required."));
        }

        String trainerId = body.get("trainerId");
        if (trainerId == null || trainerId.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Trainer ID is required"));
        }

        User member = getAuthenticatedUser(authHeader);
        User trainer = userRepository.findById(trainerId).orElse(null);

        if (trainer == null || !"trainer".equalsIgnoreCase(trainer.getRole())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid trainer selected"));
        }

        // Check if member already has a trainer
        if (member.getTrainer() != null) {
            if (member.getTrainer().getId().equals(trainer.getId())) {
                return ResponseEntity.badRequest().body(Map.of("message", "You are already assigned to this trainer."));
            }
            // Create Change Request
            try {
                trainerChangeRequestService.createRequest(member, trainer, "Member requested change via dashboard");
                return ResponseEntity.ok(Map.of("message", "Request sent to Admin for approval", "status", "PENDING"));
            } catch (RuntimeException e) {
                return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
            }
        }

        // Direct Assign (First time or Override)
        // Deactivate any existing active goals (e.g. from a previous trainer if any, or
        // self-set)
        goalService.deactivateAllGoalsForMember(member);

        member.setTrainer(trainer);
        userRepository.save(member);

        // Update trainer Stats (Optional: increment count)
        if (trainer.getAssignedMembersCount() == null)
            trainer.setAssignedMembersCount(0);
        trainer.setAssignedMembersCount(trainer.getAssignedMembersCount() + 1);
        userRepository.save(trainer);

        return ResponseEntity.ok(Map.of("message", "Trainer assigned successfully!", "trainer", trainer.getFullname(),
                "status", "ASSIGNED"));
    }

    @PostMapping("/upload-report")
    public ResponseEntity<?> uploadMedicalReport(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam("file") MultipartFile file) {

        if (!isMember(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Member role required.");
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please select a file to upload");
        }

        if (!file.getContentType().equals("application/pdf")) {
            return ResponseEntity.badRequest().body("Only PDF files are allowed");
        }

        try {
            User member = getAuthenticatedUser(authHeader);

            // Define upload directory
            String uploadDir = "uploads/reports/";
            File directory = new File(uploadDir);
            if (!directory.exists()) {
                directory.mkdirs();
            }

            // Generate unique filename
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            String filename = UUID.randomUUID().toString() + extension;

            // Save file
            Path path = Paths.get(uploadDir + filename);
            Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);

            // Update user record
            member.setMedicalReportUrl("/uploads/reports/" + filename);
            member.setMedicalReportFilename(originalFilename);
            userRepository.save(member);

            Map<String, String> response = new HashMap<>();
            response.put("message", "File uploaded successfully");
            response.put("url", member.getMedicalReportUrl());
            response.put("filename", originalFilename);

            return ResponseEntity.ok(response);

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to upload file: " + e.getMessage());
        }
    }

    // Get member dashboard info
    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String date) {
        if (!isMember(authHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Member role required.");
        }

        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtils.getEmailFromToken(token);
        String role = (String) jwtUtils.getClaims(token).get("role");

        User member = userRepository.findByEmailAndRole(email, role).orElse(null);
        if (member == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Member not found");
        }

        long trainerCount = userRepository.findAll().stream()
                .filter(u -> "trainer".equals(u.getRole()))
                .count();

        LocalDate today = LocalDate.now();
        if (date != null && !date.isEmpty()) {
            try {
                today = LocalDate.parse(date);
            } catch (Exception e) {
                // Ignore invalid date, use current
            }
        }
        final LocalDate finalToday = today;

        // Initialize collections
        List<Workout> workouts = workoutRepository.findByUser(member);
        List<Meal> meals = mealRepository.findByUser(member);
        List<WaterLog> waterLogs = waterLogRepository.findByUser(member);
        List<SleepLog> sleepLogs = sleepLogRepository.findByUser(member);

        // --- Weekly Activity (Last 7 Days) ---
        // Structure: List of objects { day="MON", actual=X, target=Y, percentage=Z }
        List<Map<String, Object>> weeklyStats = new java.util.ArrayList<>();

        // Define targets
        double targetCal = member.getTargetCaloriesBurned() != null ? member.getTargetCaloriesBurned() : 2000.0;
        double targetWater = member.getTargetWaterLiters() != null ? member.getTargetWaterLiters() : 4.0;
        double targetSleep = member.getTargetSleepHours() != null ? member.getTargetSleepHours() : 8.0;
        double targetMeal = member.getTargetMealCalories() != null ? member.getTargetMealCalories() : 2000.0;

        Map<String, Object> dashboard = new HashMap<>();
        dashboard.put("fullname", member.getFullname());
        dashboard.put("fitnessGoals", member.getFitnessGoals());
        dashboard.put("availableTrainers", trainerCount);
        dashboard.put("targets", Map.of(
                "caloriesBurned", targetCal,
                "sleepHours", targetSleep,
                "waterLiters", targetWater,
                "mealCalories", targetMeal));

        for (int i = 6; i >= 0; i--) {
            LocalDate d = finalToday.minusDays(i);
            String dayName = d.getDayOfWeek().toString().substring(0, 3); // MON, TUE etc

            // Daily Sums
            double dailyCal = workouts.stream().filter(w -> d.equals(w.getWorkoutDate()))
                    .mapToDouble(w -> w.getCaloriesBurned() != null ? w.getCaloriesBurned() : 0).sum();
            double dailyWater = waterLogs.stream().filter(w -> d.equals(w.getLogDate()))
                    .mapToDouble(w -> {
                        BigDecimal val = w.getWaterIntake();
                        if (val == null)
                            return 0.0;
                        double dVal = val.doubleValue();
                        return (dVal > 50) ? dVal / 1000.0 : dVal;
                    }).sum();
            double dailySleep = sleepLogs.stream().filter(s -> d.equals(s.getSleepDate()))
                    .mapToDouble(s -> s.getSleepHours() != null ? s.getSleepHours().doubleValue() : 0).sum();
            double dailyMeal = meals.stream()
                    .filter(m -> d.equals(m.getMealDate()))
                    .mapToDouble(Meal::getCalories)
                    .sum();

            // Format Map
            Map<String, Object> dayStat = new HashMap<>();
            dayStat.put("day", dayName);

            // Separate percentages for more effective tracking
            dayStat.put("workoutCalories", dailyCal);
            dayStat.put("mealCalories", dailyMeal);
            dayStat.put("calories", dailyCal + dailyMeal); // Keep for compatibility

            dayStat.put("workoutPct", Math.min((dailyCal / targetCal) * 100.0, 100.0));
            dayStat.put("mealPct", Math.min((dailyMeal / targetMeal) * 100.0, 100.0));

            // Water
            dayStat.put("water", dailyWater);
            dayStat.put("waterPct", Math.min((dailyWater / targetWater) * 100.0, 100.0));

            // Sleep
            dayStat.put("sleep", dailySleep);
            dayStat.put("sleepPct", Math.min((dailySleep / targetSleep) * 100.0, 100.0));

            // Overall Daily Progress (%) - Average of 4 categories
            double workoutPct = (double) dayStat.get("workoutPct");
            double mealPct = (double) dayStat.get("mealPct");
            double waterPct = (double) dayStat.get("waterPct");
            double sleepPct = (double) dayStat.get("sleepPct");

            dayStat.put("overallPct", (workoutPct + mealPct + waterPct + sleepPct) / 4.0);

            weeklyStats.add(dayStat);
            System.out.println("Day: " + dayName + ", WorkCal: " + dailyCal + ", MealCal: " + dailyMeal);
        }
        System.out.println("Weekly Progress size: " + weeklyStats.size());
        dashboard.put("weeklyProgress", weeklyStats); // New structure

        // Keep existing simple "today" stats for backward compatibility or simple
        // widgets
        double calToday = workouts.stream().filter(w -> finalToday.equals(w.getWorkoutDate()))
                .mapToDouble(w -> w.getCaloriesBurned() != null ? w.getCaloriesBurned() : 0).sum();
        double waterToday = waterLogs.stream()
                .filter(w -> finalToday.equals(w.getLogDate()))
                .mapToDouble(w -> {
                    BigDecimal val = w.getWaterIntake();
                    if (val == null)
                        return 0.0;
                    double dVal = val.doubleValue();
                    return (dVal > 50) ? dVal / 1000.0 : dVal;
                }).sum();
        double sleepToday = sleepLogs.stream()
                .filter(s -> finalToday.equals(s.getSleepDate()))
                .mapToDouble(s -> s.getSleepHours() != null ? s.getSleepHours().doubleValue() : 0.0)
                .sum();
        double mealToday = meals.stream()
                .filter(m -> finalToday.equals(m.getMealDate()))
                .mapToDouble(Meal::getCalories)
                .sum();

        double combinedToday = calToday + mealToday;

        dashboard.put("today", Map.of(
                "calories", combinedToday,
                "workoutCalories", calToday,
                "mealCalories", mealToday,
                "water", waterToday,
                "sleep", sleepToday,
                "caloriesPct", Math.min((combinedToday / targetCal) * 100, 100),
                "waterPct", Math.min((waterToday / targetWater) * 100, 100),
                "sleepPct", Math.min((sleepToday / targetSleep) * 100, 100)));

        // Trainer Details
        User trainer = member.getTrainer();
        if (trainer != null) {
            Map<String, Object> trainerInfo = new HashMap<>();
            trainerInfo.put("fullname", trainer.getFullname());
            trainerInfo.put("email", trainer.getEmail());
            trainerInfo.put("specialization", trainer.getSpecialization());
            trainerInfo.put("bio", trainer.getBio());
            trainerInfo.put("experience", trainer.getExperience());
            trainerInfo.put("certificates", trainer.getCertificates());
            dashboard.put("assignedTrainer", trainerInfo);
        } else {
            // Determine reason
            String reason = "Pending assignment";
            if (member.getFitnessGoals() == null || member.getFitnessGoals().isEmpty()) {
                reason = "No fitness goals set. Update your profile to get a trainer!";
            } else if (trainerCount == 0) {
                reason = "No trainers currently available.";
            }
            dashboard.put("trainerStatus", reason);
        }

        dashboard.put("currentStreak", calculateCurrentStreak(member));

        // --- Goal Progress Tracking (Calculation moved to Frontend Checklists) ---
        Map<String, Object> goalProgress = new HashMap<>();

        // Return blank object for now, frontend will handle calculation based on
        // checklists
        dashboard.put("goalProgress", goalProgress);

        return ResponseEntity.ok(dashboard);
    }

    private int calculateCurrentStreak(User member) {
        List<Workout> workouts = workoutRepository.findByUser(member);
        List<Meal> meals = mealRepository.findByUser(member);
        List<WaterLog> waterLogs = waterLogRepository.findByUser(member);
        List<SleepLog> sleepLogs = sleepLogRepository.findByUser(member);

        java.util.Set<LocalDate> activeDates = new java.util.HashSet<>();
        workouts.forEach(w -> activeDates.add(w.getWorkoutDate()));
        meals.forEach(m -> activeDates.add(m.getMealDate()));
        waterLogs.forEach(w -> activeDates.add(w.getLogDate()));
        sleepLogs.forEach(s -> activeDates.add(s.getSleepDate()));

        int streak = 0;
        LocalDate date = LocalDate.now();

        // If no activity today, check yesterday to start streak calculation
        if (!activeDates.contains(date)) {
            date = date.minusDays(1);
        }

        while (activeDates.contains(date)) {
            streak++;
            date = date.minusDays(1);
        }

        return streak;
    }

    @GetMapping("/medical-reports")
    public ResponseEntity<?> getMedicalReports(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        return ResponseEntity.ok(member.getMedicalReports() != null ? member.getMedicalReports() : List.of());
    }

    @PutMapping("/water-goal")
    public ResponseEntity<?> updateWaterGoal(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Double> body) {

        User member = getAuthenticatedUser(authHeader);
        Double liters = body.get("liters");

        if (liters == null || liters < 1) {
            return ResponseEntity.badRequest().body("Invalid water goal");
        }

        member.setTargetWaterLiters(liters);
        userRepository.save(member);

        return ResponseEntity.ok(Map.of("message", "Water goal updated"));
    }

    @PostMapping("/trainer-feedback")
    public ResponseEntity<?> postFeedback(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody Map<String, Object> body) {

        User member = getAuthenticatedUser(authHeader);
        User trainer = member.getTrainer();
        if (trainer == null) {
            return ResponseEntity.badRequest().body("No trainer assigned");
        }

        Integer rating = (Integer) body.get("rating");
        String comment = (String) body.get("comment");

        if (rating == null || rating < 1 || rating > 5) {
            return ResponseEntity.badRequest().body("Invalid rating. Must be between 1 and 5.");
        }

        // Check if feedback already exists for this member-trainer pair
        TrainerFeedback feedback = trainerFeedbackRepository.findByUserAndTrainer(member, trainer).orElse(null);

        if (feedback == null) {
            feedback = new TrainerFeedback();
            feedback.setTrainer(trainer);
            feedback.setUser(member);
        }

        feedback.setRating(rating);
        feedback.setComment(comment != null ? comment : "");
        feedback.setTimestamp(java.time.LocalDateTime.now());

        trainerFeedbackRepository.save(feedback);

        return ResponseEntity.ok(Map.of("message", "Feedback updated successfully"));
    }

    private User getAuthenticatedUser(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = jwtUtils.getEmailFromToken(token);
        String role = (String) jwtUtils.getClaims(token).get("role");
        return userRepository.findByEmailAndRole(email, role).orElseThrow(() -> new RuntimeException("User not found"));
    }

    private boolean isMember(String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String role = (String) jwtUtils.getClaims(token).get("role");
            return "member".equals(role) || "admin".equals(role); // Admin can also access
        } catch (Exception e) {
            return false;
        }
    }

    // ========== GOAL TRACKING ENDPOINTS ==========

    @GetMapping("/goals/progress")
    public ResponseEntity<?> getDailyProgress(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String date) {

        User member = getAuthenticatedUser(authHeader);
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now();

        List<com.fitnesssquare.model.DailyProgress> progress = goalService.getDailyProgress(member, targetDate);

        // Return goal IDs that are completed
        List<String> completedGoalIds = progress.stream()
                .filter(p -> p.isCompleted() && p.getGoal() != null)
                .map(p -> p.getGoal().getId())
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("completedGoalIds", completedGoalIds, "date", targetDate.toString()));
    }

    @PostMapping("/goals/{goalId}/complete")
    public ResponseEntity<?> markGoalComplete(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String goalId,
            @RequestParam(required = false) String date) {

        User member = getAuthenticatedUser(authHeader);
        LocalDate targetDate;
        try {
            targetDate = (date != null && !date.isEmpty()) ? LocalDate.parse(date) : LocalDate.now();
        } catch (Exception e) {
            targetDate = LocalDate.now();
        }

        if (!targetDate.equals(LocalDate.now())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Goals can only be completed for today."));
        }

        com.fitnesssquare.model.DailyProgress progress = goalService.markGoalComplete(member, goalId, targetDate);
        return ResponseEntity.ok(Map.of("message", "Goal marked as complete", "progress", progress));
    }

    @PostMapping("/goals/{goalId}/incomplete")
    public ResponseEntity<?> markGoalIncomplete(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String goalId,
            @RequestParam(required = false) String date) {

        User member = getAuthenticatedUser(authHeader);
        LocalDate targetDate;
        try {
            targetDate = (date != null && !date.isEmpty()) ? LocalDate.parse(date) : LocalDate.now();
        } catch (Exception e) {
            targetDate = LocalDate.now();
        }

        if (!targetDate.equals(LocalDate.now())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Goals can only be unchecked for today."));
        }

        goalService.markGoalIncomplete(member, goalId, targetDate);
        return ResponseEntity.ok(Map.of("message", "Goal marked as incomplete"));
    }

    @GetMapping("/goals/stats/weekly")
    public ResponseEntity<?> getWeeklyStats(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        Map<String, Object> stats = goalService.getWeeklyProgressStats(member);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/goals/history")
    public ResponseEntity<?> getGoalHistory(@RequestHeader("Authorization") String authHeader) {
        User member = getAuthenticatedUser(authHeader);
        List<com.fitnesssquare.model.MemberGoal> history = goalService.getGoalHistory(member);
        return ResponseEntity.ok(history);
    }

    @PostMapping("/goals/{goalId}/review")
    public ResponseEntity<?> submitGoalReview(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String goalId,
            @RequestBody Map<String, Object> body) {

        getAuthenticatedUser(authHeader);
        String review = (String) body.get("review");
        Integer rating = (Integer) body.get("rating");

        if (rating == null || rating < 1 || rating > 5) {
            return ResponseEntity.badRequest().body(Map.of("message", "Rating is required and must be 1-5"));
        }

        goalService.submitPlanReview(goalId, review, rating);
        return ResponseEntity.ok(Map.of("message", "Review submitted successfully"));
    }

    // ========== ACTIVITY TRACKING ENDPOINTS ==========

    @GetMapping("/activity/daily")
    public ResponseEntity<?> getActivityDaily(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String date) {

        User member = getAuthenticatedUser(authHeader);
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now();

        Map<String, Object> response = getActivityForDateRange(member, targetDate, targetDate, "daily");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/activity/weekly")
    public ResponseEntity<?> getActivityWeekly(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String date) {

        User member = getAuthenticatedUser(authHeader);
        LocalDate centerDate = date != null ? LocalDate.parse(date) : LocalDate.now();
        LocalDate startDate = centerDate.minusDays(3);
        LocalDate endDate = centerDate.plusDays(3);

        Map<String, Object> response = getActivityForDateRange(member, startDate, endDate, "weekly");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/activity/monthly")
    public ResponseEntity<?> getActivityMonthly(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String date) {

        User member = getAuthenticatedUser(authHeader);
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now();
        LocalDate startDate = targetDate.withDayOfMonth(1);
        LocalDate endDate = targetDate.withDayOfMonth(targetDate.lengthOfMonth());

        Map<String, Object> response = getActivityForDateRange(member, startDate, endDate, "monthly");
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> getActivityForDateRange(User member, LocalDate startDate, LocalDate endDate,
            String period) {
        List<Workout> workouts = workoutRepository.findByUser(member);
        List<WaterLog> waterLogs = waterLogRepository.findByUser(member);
        List<SleepLog> sleepLogs = sleepLogRepository.findByUser(member);
        List<Meal> meals = mealRepository.findByUser(member);

        // Get targets
        double targetCal = member.getTargetCaloriesBurned() != null ? member.getTargetCaloriesBurned() : 2000.0;
        double targetWater = member.getTargetWaterLiters() != null ? member.getTargetWaterLiters() : 4.0;
        double targetSleep = member.getTargetSleepHours() != null ? member.getTargetSleepHours() : 8.0;

        List<Map<String, Object>> dailyData = new ArrayList<>();
        double totalCalories = 0, totalWater = 0, totalSleep = 0;
        int dayCount = 0;

        for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
            final LocalDate currentDate = d;

            double dailyCal = workouts.stream()
                    .filter(w -> currentDate.equals(w.getWorkoutDate()))
                    .mapToDouble(w -> w.getCaloriesBurned() != null ? w.getCaloriesBurned() : 0)
                    .sum();

            double dailyWater = waterLogs.stream()
                    .filter(w -> currentDate.equals(w.getLogDate()))
                    .mapToDouble(w -> w.getWaterIntake() != null ? w.getWaterIntake().doubleValue() : 0)
                    .sum() / 1000.0;

            double dailySleep = sleepLogs.stream()
                    .filter(s -> currentDate.equals(s.getSleepDate()))
                    .mapToDouble(s -> s.getSleepHours() != null ? s.getSleepHours().doubleValue() : 0)
                    .sum();

            Map<String, Object> dayData = new HashMap<>();
            dayData.put("date", currentDate.toString());
            dayData.put("calories", Math.round(dailyCal * 10) / 10.0);
            dayData.put("water", Math.round(dailyWater * 10) / 10.0);
            dayData.put("sleep", Math.round(dailySleep * 10) / 10.0);
            dayData.put("targetCalories", targetCal);
            dayData.put("targetWater", targetWater);
            dayData.put("targetSleep", targetSleep);
            dayData.put("caloriesPct", Math.min((dailyCal / targetCal) * 100, 100));
            dayData.put("waterPct", Math.min((dailyWater / targetWater) * 100, 100));
            dayData.put("sleepPct", Math.min((dailySleep / targetSleep) * 100, 100));

            dailyData.add(dayData);

            totalCalories += dailyCal;
            totalWater += dailyWater;
            totalSleep += dailySleep;
            dayCount++;
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("avgCalories", dayCount > 0 ? Math.round((totalCalories / dayCount) * 10) / 10.0 : 0);
        summary.put("avgWater", dayCount > 0 ? Math.round((totalWater / dayCount) * 10) / 10.0 : 0);
        summary.put("avgSleep", dayCount > 0 ? Math.round((totalSleep / dayCount) * 10) / 10.0 : 0);
        summary.put("totalDays", dayCount);

        Map<String, Object> response = new HashMap<>();
        response.put("period", period);
        response.put("startDate", startDate.toString());
        response.put("endDate", endDate.toString());
        response.put("data", dailyData);
        response.put("summary", summary);

        return response;
    }

}