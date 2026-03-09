package com.fitnesssquare.repository;

import com.fitnesssquare.model.TrainerMessage;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrainerMessageRepository extends MongoRepository<TrainerMessage, String> {
    List<TrainerMessage> findByMemberOrderByTimestampDesc(User member);

    List<TrainerMessage> findByTrainerAndMemberOrderByTimestampDesc(User trainer, User member);
}
