package com.fitnesssquare.repository;

import com.fitnesssquare.model.StepLog;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDate;
import java.util.Optional;

public interface StepLogRepository extends MongoRepository<StepLog, String> {
    Optional<StepLog> findByUserAndDate(User user, LocalDate date);
}
