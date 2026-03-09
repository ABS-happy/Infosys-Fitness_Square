package com.fitnesssquare.repository;

import com.fitnesssquare.model.SleepLog;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface SleepLogRepository extends MongoRepository<SleepLog, String> {
    List<SleepLog> findByUser(User user);

    List<SleepLog> findByUserAndSleepDateBetween(User user, java.time.LocalDate startDate, java.time.LocalDate endDate);

    java.util.Optional<SleepLog> findByUserAndSleepDate(User user, java.time.LocalDate sleepDate);

    boolean existsByUserAndSleepDate(User user, java.time.LocalDate sleepDate);
}
