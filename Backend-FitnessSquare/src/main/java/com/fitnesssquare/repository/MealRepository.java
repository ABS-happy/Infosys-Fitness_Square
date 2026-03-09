package com.fitnesssquare.repository;

import com.fitnesssquare.model.Meal;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface MealRepository extends MongoRepository<Meal, String> {
    List<Meal> findByUser(User user);

    List<Meal> findByUserAndMealDateBetween(User user, java.time.LocalDate startDate, java.time.LocalDate endDate);

    boolean existsByUserAndMealDate(User user, java.time.LocalDate mealDate);

    List<Meal> findByUserAndMealDate(User user, java.time.LocalDate mealDate);
}
