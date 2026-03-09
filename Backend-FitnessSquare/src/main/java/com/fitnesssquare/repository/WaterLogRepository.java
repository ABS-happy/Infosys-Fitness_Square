package com.fitnesssquare.repository;

import com.fitnesssquare.model.WaterLog;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface WaterLogRepository extends MongoRepository<WaterLog, String> {
    List<WaterLog> findByUser(User user);

    List<WaterLog> findByUserAndLogDate(User user, java.time.LocalDate logDate);

    List<WaterLog> findByUserAndLogDateBetween(User user, java.time.LocalDate startDate, java.time.LocalDate endDate);

    boolean existsByUserAndLogDate(User user, java.time.LocalDate logDate);
}
