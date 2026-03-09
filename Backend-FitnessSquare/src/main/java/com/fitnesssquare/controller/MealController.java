package com.fitnesssquare.controller;

import com.fitnesssquare.model.Meal;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.MealRepository;
import com.fitnesssquare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/meals")
@CrossOrigin(origins = "*")
public class MealController {

    @Autowired
    private MealRepository mealRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.fitnesssquare.service.GoalService goalService;

    private java.util.Map<String, java.util.List<String>> checkGoals(User user, LocalDate date) {
        List<Meal> meals = mealRepository.findByUserAndMealDate(user, date);

        int totalCalories = meals.stream().mapToInt(Meal::getCalories).sum();
        int totalFiber = meals.stream()
                .filter(m -> m.getFiber() != null)
                .mapToInt(Meal::getFiber)
                .sum();

        java.util.List<String> completed = new java.util.ArrayList<>();
        completed.addAll(goalService.checkAndAutoComplete(user, "Nutrition", "Eat Healthy", totalCalories, date)); // Fixed:
        // Total
        // calories
        completed.addAll(goalService.checkAndAutoComplete(user, "Nutrition", "fiber", totalFiber, date)); // Fixed:
                                                                                                          // Total
        // fiber

        java.util.List<String> uncompleted = new java.util.ArrayList<>();
        uncompleted.addAll(goalService.checkAndMarkIncomplete(user, "Nutrition", totalCalories, "kcal", date));
        uncompleted.addAll(goalService.checkAndMarkIncomplete(user, "Nutrition", totalFiber, "fiber", date));

        java.util.Map<String, java.util.List<String>> result = new java.util.HashMap<>();
        result.put("completed", completed);
        result.put("uncompleted", uncompleted);
        return result;
    }

    @PostMapping
    public ResponseEntity<?> addMeal(@RequestBody java.util.Map<String, Object> payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Meal meal = new Meal();
        meal.setUser(user);

        // Manual mapping from payload
        meal.setFoodName((String) payload.get("foodName"));
        meal.setPortion((String) payload.get("portion"));
        meal.setMealType((String) payload.get("mealType"));
        meal.setCalories(parseInteger(payload.get("calories")));
        meal.setProtein(parseInteger(payload.get("protein")));
        meal.setCarbs(parseInteger(payload.get("carbs")));
        meal.setFats(parseInteger(payload.get("fats")));
        meal.setFiber(parseInteger(payload.get("fiber")));

        LocalDate date = LocalDate.now();
        if (payload.get("mealDate") != null) {
            date = LocalDate.parse((String) payload.get("mealDate"));
        }
        meal.setMealDate(date);

        java.time.LocalTime time = java.time.LocalTime.now();
        if (payload.get("mealTime") != null && !((String) payload.get("mealTime")).isEmpty()) {
            try {
                time = java.time.LocalTime.parse((String) payload.get("mealTime"));
            } catch (Exception e) {
                // Keep default now if parse fails
            }
        }
        meal.setMealTime(time);

        mealRepository.save(meal);

        // Check goals
        java.util.Map<String, java.util.List<String>> goalUpdates = checkGoals(user, date);

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Meal logged successfully");
        response.put("completedGoals", goalUpdates.get("completed"));
        response.put("incompletedGoals", goalUpdates.get("uncompleted")); // New field
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<Meal>> getMeals(Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(mealRepository.findByUser(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteMeal(@PathVariable String id, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Meal meal = mealRepository.findById(id).orElse(null);
        if (meal == null) {
            return ResponseEntity.notFound().build();
        }

        if (!meal.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Unauthorized");
        }

        mealRepository.delete(meal);

        // Check goals
        LocalDate targetDate = meal.getMealDate() != null ? meal.getMealDate() : LocalDate.now();
        java.util.Map<String, java.util.List<String>> goalUpdates = checkGoals(user, targetDate);

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Meal deleted");
        response.put("completedGoals", goalUpdates.get("completed"));
        response.put("incompletedGoals", goalUpdates.get("uncompleted"));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateMeal(@PathVariable String id, @RequestBody java.util.Map<String, Object> payload,
            Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Meal meal = mealRepository.findById(id).orElse(null);
        if (meal == null) {
            return ResponseEntity.notFound().build();
        }

        if (!meal.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        // Manual mapping from payload
        if (payload.containsKey("foodName"))
            meal.setFoodName((String) payload.get("foodName"));
        if (payload.containsKey("portion"))
            meal.setPortion((String) payload.get("portion"));
        if (payload.containsKey("mealType"))
            meal.setMealType((String) payload.get("mealType"));
        if (payload.containsKey("calories"))
            meal.setCalories(parseInteger(payload.get("calories")));
        if (payload.containsKey("protein"))
            meal.setProtein(parseInteger(payload.get("protein")));
        if (payload.containsKey("carbs"))
            meal.setCarbs(parseInteger(payload.get("carbs")));
        if (payload.containsKey("fats"))
            meal.setFats(parseInteger(payload.get("fats")));
        if (payload.containsKey("fiber"))
            meal.setFiber(parseInteger(payload.get("fiber")));

        mealRepository.save(meal);

        // Check goals
        LocalDate targetDate = meal.getMealDate() != null ? meal.getMealDate() : LocalDate.now();
        java.util.Map<String, java.util.List<String>> goalUpdates = checkGoals(user, targetDate);

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("meal", meal);
        response.put("completedGoals", goalUpdates.get("completed"));
        response.put("incompletedGoals", goalUpdates.get("uncompleted"));
        return ResponseEntity.ok(response);
    }

    private int parseInteger(Object value) {
        if (value == null || value.toString().trim().isEmpty()) {
            return 0;
        }
        try {
            return (int) Math.round(Double.parseDouble(value.toString()));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
