package com.fitnesssquare.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fitnesssquare.model.TrainerChangeRequest;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.TrainerChangeRequestRepository;
import com.fitnesssquare.repository.UserRepository;

@Service
public class TrainerChangeRequestService {

    @Autowired
    private TrainerChangeRequestRepository requestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private GoalService goalService;

    public TrainerChangeRequest createRequest(User member, User requestedTrainer, String reason) {
        // Check if there is already a pending request
        List<TrainerChangeRequest> existing = requestRepository.findByMember(member);
        for (TrainerChangeRequest req : existing) {
            if ("PENDING".equals(req.getStatus())) {
                throw new RuntimeException("You already have a pending request.");
            }
        }

        TrainerChangeRequest request = new TrainerChangeRequest();
        request.setMember(member);
        request.setCurrentTrainer(member.getTrainer());
        request.setRequestedTrainer(requestedTrainer);
        request.setReason(reason);
        request.setStatus("PENDING");
        request.setRequestDate(LocalDateTime.now());

        TrainerChangeRequest savedRequest = requestRepository.save(request);

        // Notify all Admins
        List<User> admins = userRepository.findByRole("admin");
        for (User admin : admins) {
            notificationService.createNotification(
                    admin,
                    "New trainer change request from " + member.getFullname(),
                    "INFO",
                    savedRequest.getId());
        }

        return savedRequest;
    }

    public List<TrainerChangeRequest> getPendingRequests() {
        return requestRepository.findByStatus("PENDING");
    }

    public void approveRequest(String requestId) {
        Optional<TrainerChangeRequest> reqOpt = requestRepository.findById(requestId);
        if (reqOpt.isPresent()) {
            TrainerChangeRequest req = reqOpt.get();
            if (!"PENDING".equals(req.getStatus())) {
                throw new RuntimeException("Request is not pending.");
            }

            req.setStatus("APPROVED");
            req.setResponseDate(LocalDateTime.now());
            requestRepository.save(req);

            // Update Member's Trainer
            User member = req.getMember();
            User oldTrainer = req.getCurrentTrainer();
            User newTrainer = req.getRequestedTrainer();

            // Deactivate old goals
            // Note: Autowiring GoalService is needed in this class
            goalService.deactivateAllGoalsForMember(member);

            member.setTrainer(newTrainer);
            userRepository.save(member);

            // Update Trainer counts (simplified)
            if (newTrainer.getAssignedMembersCount() == null)
                newTrainer.setAssignedMembersCount(0);
            newTrainer.setAssignedMembersCount(newTrainer.getAssignedMembersCount() + 1);
            userRepository.save(newTrainer);

            if (oldTrainer != null) {
                if (oldTrainer.getAssignedMembersCount() == null)
                    oldTrainer.setAssignedMembersCount(0);
                if (oldTrainer.getAssignedMembersCount() > 0) {
                    oldTrainer.setAssignedMembersCount(oldTrainer.getAssignedMembersCount() - 1);
                    userRepository.save(oldTrainer);
                }
            }

            // Notify Member
            notificationService.createNotification(
                    member,
                    "Your request to change trainer to " + newTrainer.getFullname() + " has been approved!",
                    "SUCCESS",
                    requestId);
        }
    }

    public void rejectRequest(String requestId) {
        Optional<TrainerChangeRequest> reqOpt = requestRepository.findById(requestId);
        if (reqOpt.isPresent()) {
            TrainerChangeRequest req = reqOpt.get();
            if (!"PENDING".equals(req.getStatus())) {
                throw new RuntimeException("Request is not pending.");
            }

            req.setStatus("REJECTED");
            req.setResponseDate(LocalDateTime.now());
            requestRepository.save(req);

            // Notify Member
            notificationService.createNotification(
                    req.getMember(),
                    "Your request to change trainer was rejected.",
                    "ERROR",
                    requestId);
        }
    }
}
