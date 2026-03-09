package com.fitnesssquare.repository;

import com.fitnesssquare.model.TrainerFeedback;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrainerFeedbackRepository extends MongoRepository<TrainerFeedback, String> {
    List<TrainerFeedback> findByTrainer(User trainer);

    List<TrainerFeedback> findByUser(User user);

    java.util.Optional<TrainerFeedback> findByUserAndTrainer(User user, User trainer);
}
