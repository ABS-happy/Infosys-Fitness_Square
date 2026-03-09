package com.fitnesssquare.repository;

import com.fitnesssquare.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);

    Optional<User> findByEmailAndRole(String email, String role);

    List<User> findAllByEmail(String email);

    List<User> findByRole(String role);

    List<User> findByRoleAndSpecialization(String role, String specialization);

    List<User> findByTrainer(User trainer);

    long countByTrainer(User trainer);

    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
            "{ $match: { role: 'member', trainer: { $exists: true, $ne: null } } }",
            "{ $group: { _id: '$trainer', count: { $sum: 1 } } }",
            "{ $sort: { count: 1 } }"
    })
    List<org.springframework.data.mongodb.core.aggregation.AggregationResults<TrainerClientCount>> countClientsPerTrainer();

    // DTO for aggregation result
    public static class TrainerClientCount {
        public String _id; // trainer ID
        public int count;
    }
}
