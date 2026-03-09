package com.fitnesssquare.service;

import com.fitnesssquare.model.Meal;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Random;

@Service
public class HealthTipService {

        @Autowired
        private UserRepository userRepository;
        @Autowired
        private MealRepository mealRepository;
        @Autowired
        private WorkoutRepository workoutRepository;
        @Autowired
        private WaterLogRepository waterLogRepository;
        @Autowired
        private SleepLogRepository sleepLogRepository;

        private final List<Map<String, String>> healthTips = Arrays.asList(
                        createTip("Hydration",
                                        "Drink at least 8 glasses of water today to stay hydrated and energized.",
                                        "fa-tint"),
                        createTip("Sleep",
                                        "Aim for 7-9 hours of sleep tonight to allow your body to recover and rebuild.",
                                        "fa-moon"),
                        createTip("Nutrition",
                                        "Eat a handful of nuts or seeds for a healthy dose of proteins and minerals.",
                                        "fa-seedling"),
                        createTip("Workout",
                                        "Try a 10-minute stretching routine before bed to improve your flexibility.",
                                        "fa-child"),
                        createTip("Activity",
                                        "Take the stairs instead of the elevator to get some extra cardio in your day.",
                                        "fa-stairs"),
                        createTip("Nutrition",
                                        "Start your day with a high-protein breakfast to keep you full and focused.",
                                        "fa-egg"),
                        createTip("Wellness",
                                        "Practice deep breathing for 5 minutes to reduce stress and improve lung capacity.",
                                        "fa-wind"),
                        createTip("Nutrition",
                                        "Avoid processed sugars and opt for whole fruits when you have a sweet craving.",
                                        "fa-apple-whole"),
                        createTip("Workout", "Consistency is key! Even a 20-minute workout is better than no workout.",
                                        "fa-dumbbell"),
                        createTip("Wellness", "Listen to your body. Rest is just as important as the workout itself.",
                                        "fa-heart"));

        private static Map<String, String> createTip(String category, String text, String icon) {
                Map<String, String> map = new java.util.HashMap<>();
                map.put("category", category);
                map.put("tip", text);
                map.put("icon", icon);
                return map;
        }

        public Map<String, String> getTipOfTheDay() {
                int dayOfYear = java.time.LocalDate.now().getDayOfYear();
                return healthTips.get(dayOfYear % healthTips.size());
        }

        public Map<String, String> getPersonalizedTip(User user) {
                java.time.LocalDate today = java.time.LocalDate.now();

                // Check today's logs
                double waterToday = waterLogRepository.findByUser(user).stream()
                                .filter(w -> w.getLogDate().equals(today))
                                .mapToDouble(w -> w.getWaterIntake().doubleValue())
                                .sum();

                double targetWater = user.getTargetWaterLiters() != null ? user.getTargetWaterLiters() : 3.5;
                if (waterToday < targetWater) {
                        double remaining = targetWater - waterToday;
                        return createTip("Hydration", "You've had " + waterToday + "L of water. Try to drink "
                                        + String.format("%.1f", remaining) + "L more for optimal performance!",
                                        "fa-droplet");
                }

                double sleepToday = sleepLogRepository.findByUser(user).stream()
                                .filter(s -> s.getSleepDate().equals(today)) // Aligned with dashboard
                                .mapToDouble(s -> s.getSleepHours() != null ? s.getSleepHours().doubleValue() : 0.0)
                                .sum();

                double targetSleep = user.getTargetSleepHours() != null ? user.getTargetSleepHours() : 8.0;
                if (sleepToday < targetSleep) {
                        return createTip("Recovery", "You got " + sleepToday + " hours of sleep today. Aim for "
                                        + targetSleep + " hours to maximize recovery!",
                                        "fa-bed");
                }

                int caloriesToday = mealRepository.findByUser(user).stream()
                                .filter(m -> m.getMealDate().equals(today))
                                .mapToInt(Meal::getCalories)
                                .sum();

                double targetMealCals = user.getTargetMealCalories() != null ? user.getTargetMealCalories() : 2000.0;
                if (caloriesToday > targetMealCals * 1.5) {
                        return createTip("Nutrition", "Calorie intake is slightly high today (" + caloriesToday
                                        + " kcal). Focus on light, fiber-rich snacks.", "fa-utensils");
                }

                // Medical report based tip
                if (user.getMedicalReports() != null && !user.getMedicalReports().isEmpty()) {
                        String report = user.getMedicalReports().get(0).toLowerCase();
                        if (report.contains("diabetes") || report.contains("sugar")) {
                                return createTip("Medical",
                                                "Reminder: Balance your carb intake with proteins to maintain stable sugar levels.",
                                                "fa-notes-medical");
                        }
                        if (report.contains("heart") || report.contains("hypertension")) {
                                return createTip("Heart Health",
                                                "Opt for potassium-rich foods like bananas or spinach to help manage blood pressure.",
                                                "fa-heart-pulse");
                        }
                }

                return getTipOfTheDay();
        }
}
