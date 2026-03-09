package com.fitnesssquare.repository;

import com.fitnesssquare.model.GymMessage;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GymMessageRepository extends MongoRepository<GymMessage, String> {
    List<GymMessage> findByTrainer(User trainer);
}
