package com.fitnesssquare.repository;

import com.fitnesssquare.model.Workout;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface WorkoutRepository extends MongoRepository<Workout, String> {
    List<Workout> findByUser(User user);

    List<Workout> findByUserAndWorkoutDate(User user, java.time.LocalDate workoutDate);

    List<Workout> findByUserAndWorkoutDateBetween(User user, java.time.LocalDate startDate,
            java.time.LocalDate endDate);

    boolean existsByUserAndWorkoutDate(User user, java.time.LocalDate workoutDate);
}
