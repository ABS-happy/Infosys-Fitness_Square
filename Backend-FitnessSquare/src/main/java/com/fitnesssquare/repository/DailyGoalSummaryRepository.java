package com.fitnesssquare.repository;

import com.fitnesssquare.model.DailyGoalSummary;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface DailyGoalSummaryRepository extends MongoRepository<DailyGoalSummary, String> {
    Optional<DailyGoalSummary> findByUserAndDate(User user, LocalDate date);
}
