package com.fitnesssquare.controller;

import com.fitnesssquare.model.User;
import com.fitnesssquare.service.GoalService;
import com.fitnesssquare.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/goals")
@CrossOrigin(origins = "*")
public class GoalController {

    @Autowired
    private GoalService goalService;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/progress-summary")
    public ResponseEntity<?> getProgressSummary(
            Principal principal,
            @RequestParam(required = false) String date) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        LocalDate targetDate;
        try {
            targetDate = (date != null && !date.isEmpty()) ? LocalDate.parse(date) : LocalDate.now();
        } catch (Exception e) {
            targetDate = LocalDate.now();
        }

        Map<String, Object> summary = goalService.getGoalProgressSummary(user, targetDate);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/trainer/goals/{memberId}/progress-summary")
    public ResponseEntity<?> getMemberProgressSummary(
            Principal principal,
            @PathVariable String memberId,
            @RequestParam(required = false) String date) {

        User trainer = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("Trainer not found"));

        User member = userRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));

        // Authorization check: Verify trainer is actually assigned to this member
        if (member.getTrainer() == null || !member.getTrainer().getId().equals(trainer.getId())) {
            return ResponseEntity.status(403)
                    .body(java.util.Collections.singletonMap("error", "Not authorized to view this member's goals"));
        }

        LocalDate targetDate;
        try {
            targetDate = (date != null && !date.isEmpty()) ? LocalDate.parse(date) : LocalDate.now();
        } catch (Exception e) {
            targetDate = LocalDate.now();
        }

        Map<String, Object> summary = goalService.getGoalProgressSummary(member, targetDate);
        return ResponseEntity.ok(summary);
    }

    @DeleteMapping("/bulk-delete")
    public ResponseEntity<?> bulkDeleteGoals(
            Principal principal,
            @RequestBody List<String> goalIds) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userRepository.findByEmail(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        goalService.deleteBulkGoals(goalIds, user);
        return ResponseEntity.ok(Map.of("message", "Goals deleted successfully"));
    }
}
