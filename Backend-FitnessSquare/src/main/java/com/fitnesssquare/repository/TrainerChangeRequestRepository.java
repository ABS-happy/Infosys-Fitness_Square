package com.fitnesssquare.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import com.fitnesssquare.model.TrainerChangeRequest;
import com.fitnesssquare.model.User;

@Repository
public interface TrainerChangeRequestRepository extends MongoRepository<TrainerChangeRequest, String> {
    List<TrainerChangeRequest> findByMember(User member);

    List<TrainerChangeRequest> findByStatus(String status);

    List<TrainerChangeRequest> findByRequestedTrainer(User trainer);
}
