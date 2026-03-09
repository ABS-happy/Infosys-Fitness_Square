package com.fitnesssquare.controller;

import com.fitnesssquare.model.DailyActivity;
import com.fitnesssquare.model.Meal;
import com.fitnesssquare.model.SleepLog;
import com.fitnesssquare.model.User;
import com.fitnesssquare.model.WaterLog;
import com.fitnesssquare.model.Workout;

import com.fitnesssquare.repository.MealRepository;
import com.fitnesssquare.repository.SleepLogRepository;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.repository.WaterLogRepository;
import com.fitnesssquare.repository.WorkoutRepository;
import com.fitnesssquare.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/activity")
public class ActivityController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private WorkoutRepository workoutRepository;

    @Autowired
    private MealRepository mealRepository;

    @Autowired
    private WaterLogRepository waterLogRepository;

    @Autowired
    private SleepLogRepository sleepLogRepository;

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(@RequestHeader("Authorization") String authHeader,
            @RequestParam String date,
            @RequestParam String filter) {
        User user = getAuthenticatedUser(authHeader);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid token");
        }

        LocalDate selectedDate;
        try {
            if (date == null || date.trim().isEmpty()) {
                selectedDate = LocalDate.now();
            } else {
                selectedDate = LocalDate.parse(date);
            }
        } catch (Exception e) {
            selectedDate = LocalDate.now();
        }
        Map<String, Object> response = new HashMap<>();

        LocalDate start = selectedDate;
        LocalDate end = selectedDate;

        if ("weekly".equalsIgnoreCase(filter)) {
            start = selectedDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            end = selectedDate.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
        } else if ("monthly".equalsIgnoreCase(filter)) {
            start = selectedDate.with(TemporalAdjusters.firstDayOfMonth());
            end = selectedDate.with(TemporalAdjusters.lastDayOfMonth());
        }

        List<Workout> workouts;
        List<Meal> meals;
        List<WaterLog> waterLogs;
        List<SleepLog> sleepLogs;

        if ("daily".equalsIgnoreCase(filter)) {
            workouts = workoutRepository.findByUserAndWorkoutDate(user, selectedDate);
            meals = mealRepository.findByUserAndMealDate(user, selectedDate);
            waterLogs = waterLogRepository.findByUserAndLogDate(user, selectedDate);

            sleepLogs = new ArrayList<>();
            sleepLogRepository.findByUserAndSleepDate(user, selectedDate).ifPresent(sleepLogs::add);

            DailyActivity activity = getCombinedActivityForDate(user, selectedDate, workouts, meals, waterLogs,
                    sleepLogs);

            System.out.println("DAILY FETCH DEBUG for user " + user.getEmail() + " on " + selectedDate);
            System.out.println("Workouts count: " + workouts.size());
            System.out.println("Meals count: " + meals.size());
            System.out.println("Water count: " + waterLogs.size());
            System.out.println("Sleep count: " + sleepLogs.size());
            System.out.println("Total Cals computed: " + activity.getCaloriesBurned());

            response.put("type", "daily");
            response.put("data", activity);
        } else {
            workouts = workoutRepository.findByUserAndWorkoutDateBetween(user, start, end);
            meals = mealRepository.findByUserAndMealDateBetween(user, start, end);
            waterLogs = waterLogRepository.findByUserAndLogDateBetween(user, start, end);
            sleepLogs = sleepLogRepository.findByUserAndSleepDateBetween(user, start, end);

            List<DailyActivity> list = new ArrayList<>();
            for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                list.add(getCombinedActivityForDate(user, d, workouts, meals, waterLogs, sleepLogs));
            }
            response.put("type", filter);
            response.put("range", Map.of("start", start, "end", end));
            response.put("stats", calculateAggregate(list));
            response.put("history", list);
        }

        // Add daily targets for Scaling in UI
        response.put("dailyTargets", Map.of(
                "calories", user.getTargetCaloriesBurned() != null ? user.getTargetCaloriesBurned() : 2000.0,
                "water", user.getTargetWaterLiters() != null ? user.getTargetWaterLiters() : 3.5,
                "sleep", user.getTargetSleepHours() != null ? user.getTargetSleepHours() : 8.0));

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> calculateAggregate(List<DailyActivity> list) {
        double totalCal = 0;
        double totalWater = 0;
        double totalSleep = 0;
        int count = list.size();

        for (DailyActivity a : list) {
            totalCal += a.getCaloriesBurned() != null ? a.getCaloriesBurned() : 0;
            totalWater += a.getWaterLiters() != null ? a.getWaterLiters() : 0;
            totalSleep += a.getSleepHours() != null ? a.getSleepHours() : 0;
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCalories", totalCal);
        stats.put("totalWater", totalWater);
        stats.put("averageSleep", count > 0 ? (totalSleep / count) : 0);
        stats.put("averageCalories", count > 0 ? (totalCal / count) : 0);
        stats.put("averageWater", count > 0 ? (totalWater / count) : 0);
        stats.put("entryCount", count);

        return stats;
    }

    private DailyActivity getCombinedActivityForDate(User user, LocalDate date, List<Workout> workouts,
            List<Meal> meals, List<WaterLog> waterLogs, List<SleepLog> sleepLogs) {
        double workoutCals = workouts.stream()
                .filter(w -> date.equals(w.getWorkoutDate()))
                .mapToDouble(w -> w.getCaloriesBurned() != null ? w.getCaloriesBurned() : 0).sum();

        double mealCals = meals.stream()
                .filter(m -> date.equals(m.getMealDate()))
                .mapToDouble(m -> m.getCalories()).sum();

        double waterLiters = waterLogs.stream()
                .filter(w -> date.equals(w.getLogDate()))
                .mapToDouble(w -> {
                    BigDecimal val = w.getWaterIntake();
                    if (val == null)
                        return 0.0;
                    double dVal = val.doubleValue();
                    return (dVal > 50) ? dVal / 1000.0 : dVal;
                }).sum();

        double sleepHours = sleepLogs.stream()
                .filter(s -> date.equals(s.getSleepDate()))
                .mapToDouble(s -> s.getSleepHours() != null ? s.getSleepHours().doubleValue() : 0).sum();

        DailyActivity daily = new DailyActivity();
        daily.setMember(user);
        daily.setDate(date);

        daily.setCaloriesBurned(workoutCals + mealCals);
        daily.setWaterLiters(waterLiters);
        daily.setSleepHours(sleepHours);
        daily.setUpdatedAt(LocalDateTime.now());

        return daily;
    }

    private User getAuthenticatedUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer "))
            return null;
        String token = authHeader.replace("Bearer ", "");
        try {
            String email = jwtUtils.getEmailFromToken(token);
            String role = (String) jwtUtils.getClaims(token).get("role");
            return userRepository.findByEmailAndRole(email, role).orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
