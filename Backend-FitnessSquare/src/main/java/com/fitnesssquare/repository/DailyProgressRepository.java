package com.fitnesssquare.repository;

import com.fitnesssquare.model.DailyProgress;
import com.fitnesssquare.model.MemberGoal;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyProgressRepository extends MongoRepository<DailyProgress, String> {
    List<DailyProgress> findByMemberAndDate(User member, LocalDate date);

    Optional<DailyProgress> findByMemberAndGoalAndDate(User member, MemberGoal goal, LocalDate date);

    List<DailyProgress> findByMemberAndDateBetween(User member, LocalDate startDate, LocalDate endDate);

    long countByMemberAndDateAndCompletedTrue(User member, LocalDate date);

    void deleteByGoalIn(List<MemberGoal> goals);
}
