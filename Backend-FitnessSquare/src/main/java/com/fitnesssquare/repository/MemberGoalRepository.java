package com.fitnesssquare.repository;

import com.fitnesssquare.model.MemberGoal;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberGoalRepository extends MongoRepository<MemberGoal, String> {
    List<MemberGoal> findByMemberAndActiveTrue(User member);

    List<MemberGoal> findByMemberAndCategoryAndActiveTrue(User member, String category);

    List<MemberGoal> findByTrainerAndMemberAndActiveTrue(User trainer, User member);

    List<MemberGoal> findByMemberAndActiveFalse(User member);

    void deleteByMemberAndTrainer(User member, User trainer);
}
