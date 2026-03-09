package com.fitnesssquare.service;

import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Set;
import java.util.ArrayList;
import java.util.HashSet;

@Service
public class TrainerAssignmentService {

    @Autowired
    private UserRepository userRepository;

    public void assignTrainerIfNeeded(User user, java.util.List<String> fitnessGoals) {
        if (user.getTrainer() != null)
            return;

        User selectedTrainer = null;
        String primaryGoal = user.getPrimaryGoal();

        // 1. Match Primary Goal
        if (primaryGoal != null && !primaryGoal.isBlank()) {
            List<User> primaryMatches = userRepository.findByRoleAndSpecialization("trainer", primaryGoal);
            if (!primaryMatches.isEmpty()) {
                selectedTrainer = getTrainerWithLeastMembers(primaryMatches);
            }
        }

        // 2. Match Secondary Goals (if no primary match)
        if (selectedTrainer == null && fitnessGoals != null && !fitnessGoals.isEmpty()) {
            // Find all matching trainers for any goal
            java.util.Set<User> secondaryMatches = new java.util.HashSet<>();
            for (String goal : fitnessGoals) {
                // Skip primary if already checked
                if (goal.equals(primaryGoal))
                    continue;
                secondaryMatches.addAll(userRepository.findByRoleAndSpecialization("trainer", goal));
            }
            if (!secondaryMatches.isEmpty()) {
                selectedTrainer = getTrainerWithLeastMembers(new java.util.ArrayList<>(secondaryMatches));
            }
        }

        // 3. Fallback: Any Trainer
        if (selectedTrainer == null) {
            List<User> allTrainers = userRepository.findByRole("trainer");
            if (!allTrainers.isEmpty()) {
                selectedTrainer = getTrainerWithLeastMembers(allTrainers);
            }
        }

        if (selectedTrainer != null) {
            user.setTrainer(selectedTrainer);
            userRepository.save(user);
            System.out.println(">>> Assigned user " + user.getEmail() + " to trainer " + selectedTrainer.getEmail());
        }
    }

    private User getTrainerWithLeastMembers(List<User> trainers) {
        if (trainers == null || trainers.isEmpty())
            return null;

        // Fetch pre-aggregated counts
        List<org.springframework.data.mongodb.core.aggregation.AggregationResults<UserRepository.TrainerClientCount>> rawResults = userRepository
                .countClientsPerTrainer();

        java.util.Map<String, Integer> counts = new java.util.HashMap<>();
        if (rawResults != null && !rawResults.isEmpty() && rawResults.get(0).getMappedResults() != null) {
            for (UserRepository.TrainerClientCount tc : rawResults.get(0).getMappedResults()) {
                if (tc._id != null) {
                    counts.put(tc._id, tc.count);
                }
            }
        }

        User bestTrainer = null;
        int minClients = Integer.MAX_VALUE;

        for (User trainer : trainers) {
            int clientsCount = counts.getOrDefault(trainer.getId(), 0);
            if (clientsCount < minClients) {
                minClients = clientsCount;
                bestTrainer = trainer;
            }
        }
        return bestTrainer;
    }
}
