package com.fitnesssquare.repository;

import com.fitnesssquare.model.DailyActivity;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyActivityRepository extends MongoRepository<DailyActivity, String> {
    Optional<DailyActivity> findByMemberAndDate(User member, LocalDate date);

    List<DailyActivity> findByMemberAndDateBetween(User member, LocalDate startDate, LocalDate endDate);

    List<DailyActivity> findByMember(User member);
}
