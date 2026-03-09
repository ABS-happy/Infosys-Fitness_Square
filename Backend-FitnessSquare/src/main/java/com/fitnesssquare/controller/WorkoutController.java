package com.fitnesssquare.controller;

import com.fitnesssquare.model.Workout;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.WorkoutRepository;
import com.fitnesssquare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/workouts")
@CrossOrigin(origins = "*")
public class WorkoutController {

    @Autowired
    private WorkoutRepository workoutRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.fitnesssquare.service.GoalService goalService;

    @PostMapping
    public ResponseEntity<?> addWorkout(@RequestBody java.util.Map<String, Object> payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Workout workout = new Workout();
        workout.setUser(user);

        // Manual mapping from payload
        workout.setExerciseName((String) payload.get("exerciseName"));
        workout.setExerciseType((String) payload.get("exerciseType"));
        workout.setSets(parseInteger(payload.get("sets")));
        workout.setReps(parseInteger(payload.get("reps")));
        workout.setWeight(parseInteger(payload.get("weight")));
        workout.setDurationMinutes(parseInteger(payload.get("durationMinutes")));
        workout.setCaloriesBurned(parseInteger(payload.get("caloriesBurned")));

        LocalDate date = LocalDate.now();
        if (payload.get("workoutDate") != null) {
            date = LocalDate.parse((String) payload.get("workoutDate"));
        }
        workout.setWorkoutDate(date);

        workoutRepository.save(workout);

        // Auto-complete goal
        java.util.List<String> completedGoals = new java.util.ArrayList<>();
        try {
            completedGoals = goalService.checkAndAutoComplete(user, "Workout", workout.getExerciseName(),
                    workout.getDurationMinutes(), date);
        } catch (Exception e) {
            System.err.println("Error auto-completing goal: " + e.getMessage());
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("message", "Workout logged successfully");
        response.put("completedGoals", completedGoals);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<Workout>> getWorkouts(Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return ResponseEntity.ok(workoutRepository.findByUser(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteWorkout(@PathVariable String id, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Workout workout = workoutRepository.findById(id).orElse(null);
        if (workout == null) {
            return ResponseEntity.notFound().build();
        }

        if (!workout.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).body("Unauthorized");
        }

        workoutRepository.delete(workout);

        // Auto-uncheck logic
        try {
            LocalDate targetDate = workout.getWorkoutDate() != null ? workout.getWorkoutDate() : LocalDate.now();
            int totalDuration = workoutRepository.findByUser(user).stream()
                    .filter(w -> w.getWorkoutDate() != null && w.getWorkoutDate().equals(targetDate))
                    .mapToInt(Workout::getDurationMinutes)
                    .sum();

            goalService.checkAndMarkIncomplete(user, "Workout", totalDuration, "min", targetDate);
        } catch (Exception e) {
            System.err.println("Error auto-unchecking goal: " + e.getMessage());
        }

        return ResponseEntity.ok("Workout deleted");
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateWorkout(@PathVariable String id, @RequestBody java.util.Map<String, Object> payload,
            Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).build();
        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        Workout workout = workoutRepository.findById(id).orElse(null);
        if (workout == null) {
            return ResponseEntity.notFound().build();
        }

        if (!workout.getUser().getId().equals(user.getId())) {
            return ResponseEntity.status(403).build();
        }

        // Manual mapping from payload
        if (payload.containsKey("exerciseName"))
            workout.setExerciseName((String) payload.get("exerciseName"));
        if (payload.containsKey("exerciseType"))
            workout.setExerciseType((String) payload.get("exerciseType"));
        if (payload.containsKey("sets"))
            workout.setSets(parseInteger(payload.get("sets")));
        if (payload.containsKey("reps"))
            workout.setReps(parseInteger(payload.get("reps")));
        if (payload.containsKey("weight"))
            workout.setWeight(parseInteger(payload.get("weight")));
        if (payload.containsKey("durationMinutes"))
            workout.setDurationMinutes(parseInteger(payload.get("durationMinutes")));
        if (payload.containsKey("caloriesBurned"))
            workout.setCaloriesBurned(parseInteger(payload.get("caloriesBurned")));

        return ResponseEntity.ok(workoutRepository.save(workout));
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
