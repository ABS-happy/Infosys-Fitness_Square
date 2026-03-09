package com.fitnesssquare.repository;

import com.fitnesssquare.model.SessionSchedule;
import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionScheduleRepository extends MongoRepository<SessionSchedule, String> {
    List<SessionSchedule> findByTrainer(User trainer);

    List<SessionSchedule> findByUser(User user);

    List<SessionSchedule> findByTrainerAndUserIsNull(User trainer);
}
