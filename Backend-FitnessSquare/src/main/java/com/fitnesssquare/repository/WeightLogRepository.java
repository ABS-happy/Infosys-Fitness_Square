package com.fitnesssquare.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.fitnesssquare.model.User;
import com.fitnesssquare.model.WeightLog;

public interface WeightLogRepository extends MongoRepository<WeightLog, String> {
    Optional<WeightLog> findByUserAndDate(User user, LocalDate date);

    List<WeightLog> findByUserAndDateBetween(User user, LocalDate startDate, LocalDate endDate);

    Optional<WeightLog> findFirstByUserOrderByDateAsc(User user);
}
