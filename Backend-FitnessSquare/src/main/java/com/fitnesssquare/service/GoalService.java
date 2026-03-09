package com.fitnesssquare.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fitnesssquare.model.DailyProgress;
import com.fitnesssquare.model.MemberGoal;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.DailyProgressRepository;
import com.fitnesssquare.repository.MemberGoalRepository;
import com.fitnesssquare.repository.DailyGoalSummaryRepository;
import com.fitnesssquare.model.DailyGoalSummary;

@Service
public class GoalService {

    @Autowired
    private MemberGoalRepository goalRepository;

    @Autowired
    private DailyProgressRepository progressRepository;

    /**
     * Create a new goal for a member
     */
    public MemberGoal createGoal(User trainer, User member, String category, String taskDescription,
            LocalDate startDate, LocalDate endDate) {
        MemberGoal goal = new MemberGoal();
        goal.setMember(member);
        goal.setTrainer(trainer);
        goal.setCategory(category);
        goal.setTaskDescription(taskDescription);
        goal.setStartDate(startDate);
        goal.setEndDate(endDate);
        goal.setActive(true);
        goal.setCreatedAt(LocalDateTime.now());
        return goalRepository.save(goal);
    }

    /**
     * Overloaded method for creating a goal without dates
     */
    public MemberGoal createGoal(User trainer, User member, String category, String taskDescription) {
        return createGoal(trainer, member, category, taskDescription, null, null);
    }

    public List<MemberGoal> getActiveGoalsForMember(User member, LocalDate date) {
        return goalRepository.findByMemberAndActiveTrue(member).stream()
                // .filter(g -> g.getTrainer() != null) // Allow self/system assigned goals
                .filter(g -> (g.getStartDate() == null || !date.isBefore(g.getStartDate())) &&
                        (g.getEndDate() == null || !date.isAfter(g.getEndDate())))
                .collect(Collectors.toList());
    }

    // Overload for backward compatibility (defaults to Today)
    public List<MemberGoal> getActiveGoalsForMember(User member) {
        return getActiveGoalsForMember(member, LocalDate.now());
    }

    /**
     * Get goals grouped by category
     */
    public Map<String, List<MemberGoal>> getGoalsByCategory(User member) {
        List<MemberGoal> goals = getActiveGoalsForMember(member, LocalDate.now());
        System.out
                .println("Fetching goals for member " + member.getId() + ". Found " + goals.size() + " active goals.");
        return goals.stream().collect(Collectors.groupingBy(MemberGoal::getCategory));
    }

    /**
     * Get daily progress for a specific date
     */
    public List<DailyProgress> getDailyProgress(User member, LocalDate date) {
        return progressRepository.findByMemberAndDate(member, date);
    }

    /**
     * Mark a goal as complete for today
     */
    public DailyProgress markGoalComplete(User member, String goalId, LocalDate date) {
        MemberGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new RuntimeException("Goal not found"));

        Optional<DailyProgress> existing = progressRepository.findByMemberAndGoalAndDate(member, goal, date);

        if (existing.isPresent()) {
            DailyProgress progress = existing.get();
            progress.setCompleted(true);
            progress.setCompletedAt(LocalDateTime.now());
            DailyProgress saved = progressRepository.save(progress);
            clearDailySummaryCache(member, date);
            return saved;
        } else {
            DailyProgress progress = new DailyProgress();
            progress.setMember(member);
            progress.setGoal(goal);
            progress.setDate(date);
            progress.setCompleted(true);
            progress.setCompletedAt(LocalDateTime.now());
            DailyProgress saved = progressRepository.save(progress);
            clearDailySummaryCache(member, date);
            return saved;
        }
    }

    /**
     * Mark a goal as incomplete for today
     */
    public void markGoalIncomplete(User member, String goalId, LocalDate date) {
        MemberGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new RuntimeException("Goal not found"));

        Optional<DailyProgress> existing = progressRepository.findByMemberAndGoalAndDate(member, goal, date);
        if (existing.isPresent()) {
            progressRepository.delete(existing.get());
            clearDailySummaryCache(member, date);
        }
    }

    private void clearDailySummaryCache(User member, LocalDate date) {
        if (dailyGoalSummaryRepository != null) {
            dailyGoalSummaryRepository.findByUserAndDate(member, date)
                    .ifPresent(dailyGoalSummaryRepository::delete);
        }
    }

    /**
     * Get weekly progress statistics
     */
    public Map<String, Object> getWeeklyProgressStats(User member) {
        LocalDate today = LocalDate.now();
        LocalDate weekAgo = today.minusDays(6);

        List<DailyProgress> weekProgress = progressRepository.findByMemberAndDateBetween(member, weekAgo, today);

        // Calculate total possible completions dynamically for each day of the week
        int totalPossibleCompletions = 0;
        for (int i = 0; i < 7; i++) {
            LocalDate d = today.minusDays(i);
            totalPossibleCompletions += getActiveGoalsForMember(member, d).size();
        }

        int completedCount = (int) weekProgress.stream().filter(DailyProgress::isCompleted).count();

        double completionPercentage = totalPossibleCompletions > 0
                ? (completedCount * 100.0 / totalPossibleCompletions)
                : 0.0;

        // Calculate streak
        int currentStreak = calculateStreak(member);

        // Active goals count for TODAY
        int currentActiveGoals = getActiveGoalsForMember(member, today).size();

        Map<String, Object> stats = new HashMap<>();
        stats.put("weeklyCompletionPercentage", Math.round(completionPercentage * 10) / 10.0);
        stats.put("completedGoals", completedCount);
        stats.put("totalPossibleCompletions", totalPossibleCompletions);
        stats.put("currentStreak", currentStreak);
        stats.put("activeGoalsCount", currentActiveGoals);

        return stats;
    }

    /**
     * Calculate current streak (consecutive days with all goals completed)
     */
    private int calculateStreak(User member) {
        int streak = 0;
        LocalDate today = LocalDate.now();
        LocalDate lastYear = today.minusDays(365);

        // 1. Fetch all progress records for the past year IN ONE QUERY
        List<DailyProgress> pastYearProgress = progressRepository.findByMemberAndDateBetween(member, lastYear, today);

        // 2. Group progress by date (only counting completed goals)
        Map<LocalDate, Long> completionsByDate = pastYearProgress.stream()
                .filter(DailyProgress::isCompleted)
                .collect(Collectors.groupingBy(DailyProgress::getDate, Collectors.counting()));

        // 3. Fetch all member goals to calculate active goals dynamically without
        // querying DB per day
        List<MemberGoal> allGoals = goalRepository.findByMemberAndActiveTrue(member);

        LocalDate checkDate = today;

        for (int i = 0; i < 365; i++) {
            final LocalDate currentDate = checkDate;

            // Reconstruct active goals for 'currentDate' in-memory
            long activeGoalsCount = allGoals.stream()
                    .filter(g -> (g.getStartDate() == null || !currentDate.isBefore(g.getStartDate())) &&
                            (g.getEndDate() == null || !currentDate.isAfter(g.getEndDate())))
                    .count();

            if (activeGoalsCount == 0) {
                if (i == 0) {
                    checkDate = checkDate.minusDays(1);
                    continue;
                } else {
                    // Ignore rest days and keep checking backwards
                    checkDate = checkDate.minusDays(1);
                    continue;
                }
            }

            long completedToday = completionsByDate.getOrDefault(currentDate, 0L);

            if (completedToday >= activeGoalsCount) {
                streak++;
                checkDate = checkDate.minusDays(1);
            } else {
                break;
            }
        }

        return streak;
    }

    public void deleteGoal(String goalId) {
        MemberGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new RuntimeException("Goal not found"));
        goal.setActive(false);
        goalRepository.save(goal);
    }

    /**
     * Deactivate all active goals created by a trainer for a member
     */

    public void deactivateOldTrainerGoals(User trainer, User member) {
        List<MemberGoal> existing = goalRepository.findByTrainerAndMemberAndActiveTrue(trainer, member);
        for (MemberGoal g : existing) {
            g.setActive(false);
        }
        goalRepository.saveAll(existing);
    }

    public List<MemberGoal> getGoalHistory(User member) {
        return goalRepository.findByMemberAndActiveFalse(member);
    }

    public void submitPlanReview(String goalId, String review, Integer rating) {
        MemberGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new RuntimeException("Goal not found"));
        goal.setPlanReview(review);
        goal.setPlanRating(rating);
        goalRepository.save(goal);
    }

    /**
     * Deactivate ALL active goals for a member (used when changing trainers)
     */
    public void deactivateAllGoalsForMember(User member) {
        System.out.println("Deactivating all goals for member: " + member.getId());
        List<MemberGoal> allActive = goalRepository.findByMemberAndActiveTrue(member);
        System.out.println("Found " + allActive.size() + " active goals to deactivate.");
        for (MemberGoal g : allActive) {
            g.setActive(false);
        }
        goalRepository.saveAll(allActive);
        System.out.println("All goals deactivated.");
    }

    /**
     * Assign default goals based on member's fitness goals
     */
    public void assignDefaultGoals(User member) {
        if (member.getFitnessGoals() == null || member.getFitnessGoals().isEmpty()) {
            return;
        }

        // Get existing goal descriptions to avoid duplicates
        Set<String> existingGoals = goalRepository.findByMemberAndActiveTrue(member)
                .stream()
                .map(MemberGoal::getTaskDescription)
                .collect(Collectors.toSet());

        for (String goalType : member.getFitnessGoals()) {
            List<DefaultGoal> defaults = getDefaultGoalsForType(goalType);
            for (DefaultGoal dg : defaults) {
                if (!existingGoals.contains(dg.description)) {
                    createGoal(null, member, dg.category, dg.description);
                }
            }
        }
    }

    private static class DefaultGoal {
        String category;
        String description;

        DefaultGoal(String cat, String desc) {
            this.category = cat;
            this.description = desc;
        }
    }

    private List<DefaultGoal> getDefaultGoalsForType(String type) {
        List<DefaultGoal> goals = new ArrayList<>();
        String lowerType = type.toLowerCase();

        if (lowerType.contains("muscle") || lowerType.contains("gain")) {
            goals.add(new DefaultGoal("Workout", "Strength Training (45m)"));
            goals.add(new DefaultGoal("Workout", "Log sets and reps for all exercises"));
            goals.add(new DefaultGoal("Nutrition", "Eat 3000 kcal"));
            goals.add(new DefaultGoal("Nutrition", "Drink 3L Water"));
            goals.add(new DefaultGoal("Sleep", "Sleep 8+ Hours"));
        } else if (lowerType.contains("weight") || lowerType.contains("loss") || lowerType.contains("fat")) {
            goals.add(new DefaultGoal("Workout", "Cardio Session (30m)"));
            goals.add(new DefaultGoal("Workout", "Complete 10,000 steps today"));
            goals.add(new DefaultGoal("Nutrition", "Eat 1800 kcal"));
            goals.add(new DefaultGoal("Nutrition", "Zero processed sugars or junk food"));
            goals.add(new DefaultGoal("Habit", "Drink 3L Water"));
        } else if (lowerType.contains("health") || lowerType.contains("general") || lowerType.contains("fitness")) {
            goals.add(new DefaultGoal("Workout", "Physical Activity (30m)"));
            goals.add(new DefaultGoal("Workout", "Full Body Stretching (10m)"));
            goals.add(new DefaultGoal("Nutrition", "Drink 2.5L Water"));
            goals.add(new DefaultGoal("Habit", "No screen time 45m before bed"));
            goals.add(new DefaultGoal("Sleep", "Sleep 7+ Hours"));
        } else if (lowerType.contains("recovery") || lowerType.contains("injury") || lowerType.contains("rehab")) {
            goals.add(new DefaultGoal("Workout", "Complete prescribed PT exercises"));
            goals.add(new DefaultGoal("Workout", "Focused Mobility Work (15m)"));
            goals.add(new DefaultGoal("Nutrition", "Consume anti-inflammatory foods (Omega-3s)"));
            goals.add(new DefaultGoal("Habit", "Apply heat/ice therapy if prescribed"));
            goals.add(new DefaultGoal("Sleep", "Sleep 9+ Hours"));
        }
        return goals;
    }

    /**
     * Get goals created by a trainer for a specific member
     */
    public List<MemberGoal> getGoalsByTrainerAndMember(User trainer, User member) {
        return goalRepository.findByTrainerAndMemberAndActiveTrue(trainer, member);
    }

    /**
     * Get goal completion stats for a specific period
     */
    public Map<String, Object> getGoalStatsForPeriod(User member, LocalDate endDate, int days) {
        LocalDate startDate = endDate.minusDays(days - 1);
        List<DailyProgress> periodProgress = progressRepository.findByMemberAndDateBetween(member, startDate, endDate);
        List<MemberGoal> activeGoals = getActiveGoalsForMember(member, endDate); // Fixed: Use endDate

        int totalGoals = activeGoals.size();
        int totalPossibleCompletions = totalGoals * days;
        int completedCount = (int) periodProgress.stream().filter(DailyProgress::isCompleted).count();

        double completionPercentage = totalPossibleCompletions > 0
                ? (completedCount * 100.0 / totalPossibleCompletions)
                : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("completionPercentage", Math.round(completionPercentage * 10) / 10.0);
        stats.put("completedCount", completedCount);
        stats.put("totalPossible", totalPossibleCompletions);
        stats.put("activeGoalsCount", totalGoals);
        stats.put("startDate", startDate.toString());
        stats.put("endDate", endDate.toString());

        return stats;
    }

    /**
     * Get goal completion stats for a specific period grouped by category
     */

    /**
     * Auto-complete goals based on logged activity
     */
    public List<String> checkAndAutoComplete(User member, String category, String description, double value,
            LocalDate date) {
        List<MemberGoal> activeGoals = getActiveGoalsForMember(member, date);
        List<String> completedGoals = new ArrayList<>();

        for (MemberGoal goal : activeGoals) {
            // Removed strict category mismatch check to allow keywords to bridge categories
            // (e.g., Fiber goals in 'Habit' category matches 'Nutrition' logs)

            boolean match = false;
            String goalDesc = goal.getTaskDescription().toLowerCase();

            boolean quantitativeMatchAttempted = false;
            boolean quantitativeMatchSuccess = false;

            // 1. Check Quantitative Logic First
            // Water
            boolean isWaterCategory = category.equalsIgnoreCase("Habit") || category.equalsIgnoreCase("Hydration");
            if (isWaterCategory && goalDesc.contains("water")) {
                double target = extractTargetNumber(goalDesc);
                if (target > 0) {
                    quantitativeMatchAttempted = true;
                    double normalizedTarget = target;
                    if (goalDesc.contains("ml"))
                        normalizedTarget /= 1000.0;
                    if (value >= normalizedTarget)
                        quantitativeMatchSuccess = true;
                }
            }
            // Sleep
            else if (category.equalsIgnoreCase("Sleep")) {
                double target = extractTargetNumber(goalDesc);
                if (target > 0) {
                    quantitativeMatchAttempted = true;
                    if (value >= target)
                        quantitativeMatchSuccess = true;
                }
            }
            // Steps
            else if ((category.equalsIgnoreCase("Workout") || category.equalsIgnoreCase("General Health")
                    || category.equalsIgnoreCase("Goal")) && goalDesc.contains("step")) {
                double target = extractTargetNumber(goalDesc);
                if (target > 0) {
                    quantitativeMatchAttempted = true;
                    if (value >= target)
                        quantitativeMatchSuccess = true;
                }
            }
            // Workout Duration
            else if (category.equalsIgnoreCase("Workout") && (goalDesc.contains("min") || goalDesc.contains("m "))) {
                double target = extractTargetNumber(goalDesc);
                if (target > 0) {
                    quantitativeMatchAttempted = true;
                    if (value >= target)
                        quantitativeMatchSuccess = true;
                }
            }
            // Nutrition Calories
            else if (category.equalsIgnoreCase("Nutrition")
                    && (goalDesc.contains("cal") || goalDesc.contains("kcal"))) {
                double target = extractTargetNumber(goalDesc);
                if (target > 0) {
                    quantitativeMatchAttempted = true;
                    if (value >= target)
                        quantitativeMatchSuccess = true;
                }
            }
            // Nutrition Fiber
            boolean isFiberKeyword = goalDesc.contains("fiber");
            boolean isNutritionCategory = category.equalsIgnoreCase("Nutrition") || category.equalsIgnoreCase("Habit")
                    || category.equalsIgnoreCase("Goal") || category.equalsIgnoreCase("Meal");
            if (isFiberKeyword && isNutritionCategory) {
                double target = extractTargetNumber(goalDesc);
                if (target > 0) {
                    quantitativeMatchAttempted = true;
                    if (value >= target)
                        quantitativeMatchSuccess = true;
                }
            }

            if (quantitativeMatchAttempted) {
                match = quantitativeMatchSuccess;
            } else {
                // 2. Generic Description Match
                // For Water, don't allow generic match if the description contains a
                // number-like pattern
                // but extractTargetNumber failed (e.g., "3.5L" might need better parsing, but
                // we shouldn't just say 'match').
                boolean isWaterGoal = goalDesc.contains("water");
                boolean hasNumberPattern = goalDesc.matches(".*\\d+.*");

                if (isWaterGoal && hasNumberPattern) {
                    // If it's a water goal with a number but we didn't quantitative match it,
                    // it's likely a misconfiguration or parsing issue - don't auto-complete
                    // generically.
                    match = false;
                } else if (description != null && goalDesc.contains(description.toLowerCase())) {
                    match = true;
                } else if (category.equalsIgnoreCase("Workout") && (goalDesc.contains("workout")
                        || goalDesc.contains("activity") || goalDesc.contains("exercise"))) {
                    match = true;
                }
            }

            if (match) {
                // Check if goal was already completed for this date
                Optional<DailyProgress> existingProgress = progressRepository.findByMemberAndGoalAndDate(member, goal,
                        date);
                boolean alreadyCompleted = existingProgress.isPresent() && existingProgress.get().isCompleted();

                if (!alreadyCompleted) {
                    markGoalComplete(member, goal.getId(), date);
                    System.out.println("Auto-completed goal: " + goal.getTaskDescription());
                    completedGoals.add(goal.getTaskDescription());
                }
            }
        }
        return completedGoals;
    }

    /**
     * Re-evaluate goals after a log deletion and uncheck if criteria no longer met
     */
    public List<String> checkAndMarkIncomplete(User member, String category, double value, String unitContext,
            LocalDate date) {
        List<MemberGoal> activeGoals = getActiveGoalsForMember(member, date);
        List<String> uncheckGoals = new ArrayList<>();

        for (MemberGoal goal : activeGoals) {
            // Category mismatch
            if (!goal.getCategory().equalsIgnoreCase(category))
                continue;

            // Check existence in DailyProgress first
            Optional<DailyProgress> progress = progressRepository.findByMemberAndGoalAndDate(member, goal, date);
            if (progress.isEmpty() || !progress.get().isCompleted())
                continue;

            String goalDesc = goal.getTaskDescription().toLowerCase();
            double target = extractTargetNumber(goalDesc);
            if (target <= 0)
                continue;

            boolean matchUnit = false;
            // Normalize Target
            if (unitContext.equals("min") && (goalDesc.contains("min") || goalDesc.contains("m "))) {
                matchUnit = true;
            } else if (unitContext.equals("kcal") && (goalDesc.contains("kcal") || goalDesc.contains("cal"))) {
                matchUnit = true;
            } else if (unitContext.equals("L") && goalDesc.contains("water")) {
                matchUnit = true;
                if (goalDesc.contains("ml"))
                    target /= 1000.0;
            } else if (unitContext.equals("hours") && category.equalsIgnoreCase("Sleep")) {
                matchUnit = true;
            } else if (unitContext.equals("steps") && goalDesc.contains("steps")) { // Added steps support
                matchUnit = true;
            } else if (unitContext.equals("fiber") && goalDesc.contains("fiber")) {
                matchUnit = true;
            } else if (unitContext.equals("generic")) {
                // For generic "Workout" goals without specific numbers, we might not uncheck
                // them
                // unless count is 0. But for now, safe to skip.
            }

            if (matchUnit && value < target) {
                markGoalIncomplete(member, goal.getId(), date);
                System.out.println("Auto-unchecked goal: " + goal.getTaskDescription());
                uncheckGoals.add(goal.getTaskDescription());
            }
        }
        return uncheckGoals;
    }

    private double extractTargetNumber(String text) {
        if (text == null)
            return 0.0;
        try {
            // Improved regex to handle commas like "10,000" and decimals
            java.util.regex.Pattern p = java.util.regex.Pattern
                    .compile("(\\d{1,3}(,\\d{3})*(\\.\\d+)?|\\d+(\\.\\d+)?)");
            java.util.regex.Matcher m = p.matcher(text);
            if (m.find()) {
                String match = m.group(1).replace(",", "");
                return Double.parseDouble(match);
            }
        } catch (Exception e) {
            // ignore
        }
        return 0.0;
    }

    public Map<String, Map<String, Object>> getGoalStatsByCategoryForPeriod(User member, LocalDate endDate, int days) {
        LocalDate startDate = endDate.minusDays(days - 1);
        List<DailyProgress> periodProgress = progressRepository.findByMemberAndDateBetween(member, startDate, endDate);
        List<MemberGoal> activeGoals = getActiveGoalsForMember(member, endDate); // Fixed: Use endDate

        Map<String, List<MemberGoal>> goalsByCategory = activeGoals.stream()
                .collect(Collectors.groupingBy(MemberGoal::getCategory));

        Map<String, Map<String, Object>> categoryStats = new HashMap<>();

        for (Map.Entry<String, List<MemberGoal>> entry : goalsByCategory.entrySet()) {
            String category = entry.getKey();
            List<MemberGoal> categoryGoals = entry.getValue();
            Set<String> categoryGoalIds = categoryGoals.stream().map(MemberGoal::getId).collect(Collectors.toSet());

            long completedInCategory = periodProgress.stream()
                    .filter(p -> p.isCompleted() && categoryGoalIds.contains(p.getGoal().getId()))
                    .count();

            int totalPossibleInCategory = categoryGoals.size() * days;
            double pct = totalPossibleInCategory > 0 ? (completedInCategory * 100.0 / totalPossibleInCategory) : 0.0;

            Map<String, Object> stats = new HashMap<>();
            stats.put("pct", Math.round(pct * 10) / 10.0);
            stats.put("completed", completedInCategory);
            stats.put("total", totalPossibleInCategory);

            categoryStats.put(category, stats);
        }

        return categoryStats;
    }

    @Autowired
    private DailyGoalSummaryRepository dailyGoalSummaryRepository;

    /**
     * Get summary of goal progress for dashboard
     */
    public Map<String, Object> getGoalProgressSummary(User member) {
        return getGoalProgressSummary(member, LocalDate.now());
    }

    public Map<String, Object> getGoalProgressSummary(User member, LocalDate targetDate) {
        // 1. Check if summary already exists in DB
        Optional<DailyGoalSummary> existingSummary = dailyGoalSummaryRepository.findByUserAndDate(member, targetDate);

        if (existingSummary.isPresent()) {
            DailyGoalSummary summary = existingSummary.get();
            Map<String, Object> result = new HashMap<>();
            result.put("weightProgress", summary.getWeightProgress());
            result.put("exerciseAdherence", summary.getExerciseAdherence());
            result.put("habitScore", summary.getHabitScore());
            result.put("exerciseText", summary.getExerciseText());
            return result;
        }

        // 2. Calculate Fresh Stats (if not found)
        // Weight Progress (Weight + Nutrition + Meal + Goal) - DAILY
        Map<String, Object> weightStats = getDailyCategoryStats(member,
                java.util.Arrays.asList("Weight", "Nutrition", "Meal", "Goal"), targetDate);
        double weightProgress = (double) weightStats.get("pct");

        // Exercise Adherence (Workout + Exercise) - DAILY
        Map<String, Object> workoutStats = getDailyCategoryStats(member,
                java.util.Arrays.asList("Workout", "Exercise"), targetDate);
        double exerciseAdherence = (double) workoutStats.get("pct");

        // Habit Score (Habit + Hydration + Sleep) - DAILY
        Map<String, Object> habitStats = getDailyCategoryStats(member,
                java.util.Arrays.asList("Habit", "Hydration", "Sleep"), targetDate);
        double habitScore = (double) habitStats.get("pct");

        // Prepare Result Map
        Map<String, Object> summary = new HashMap<>();
        summary.put("weightProgress", weightProgress);
        summary.put("exerciseAdherence", exerciseAdherence);
        summary.put("habitScore", habitScore);

        long workoutCompleted = ((Number) workoutStats.get("completed")).longValue();
        long workoutTotal = ((Number) workoutStats.get("total")).longValue();
        String exerciseText = workoutCompleted + " of " + workoutTotal + " tasks";
        summary.put("exerciseText", exerciseText);

        // 3. Persist to DB
        try {
            DailyGoalSummary newSummary = new DailyGoalSummary();
            newSummary.setUser(member);
            newSummary.setDate(targetDate);
            newSummary.setWeightProgress(weightProgress);
            newSummary.setExerciseAdherence(exerciseAdherence);
            newSummary.setHabitScore(habitScore);
            newSummary.setExerciseText(exerciseText);
            newSummary.setUpdatedAt(LocalDateTime.now());
            dailyGoalSummaryRepository.save(newSummary);
        } catch (Exception e) {
            System.err.println("Failed to save DailyGoalSummary: " + e.getMessage());
        }

        return summary;
    }

    private Map<String, Object> getDailyCategoryStats(User member, List<String> categories, LocalDate date) {
        // Get active goals for THESE categories on THIS specific date
        List<MemberGoal> goals = getActiveGoalsForMember(member, date).stream()
                .filter(g -> categories.stream().anyMatch(c -> c.equalsIgnoreCase(g.getCategory())))
                .collect(Collectors.toList());

        if (goals.isEmpty()) {
            Map<String, Object> stats = new HashMap<>();
            stats.put("pct", 0.0);
            stats.put("completed", 0L);
            stats.put("total", 0L);
            return stats;
        }

        // Fetch progress for these goals on this date
        List<DailyProgress> progressList = progressRepository.findByMemberAndDate(member, date);
        Set<String> catGoalIds = goals.stream().map(MemberGoal::getId).collect(Collectors.toSet());

        long completed = progressList.stream()
                .filter(p -> p.isCompleted() && p.getGoal() != null && catGoalIds.contains(p.getGoal().getId()))
                .count();

        long totalCount = goals.size();
        double pct = totalCount > 0 ? (completed * 100.0 / totalCount) : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("pct", Math.round(pct * 10) / 10.0);
        stats.put("completed", completed);
        stats.put("total", totalCount);
        return stats;
    }

    public Map<String, Object> getGoalCompletionCalendar(User member) {
        // Get active goals to determine plan date range
        List<MemberGoal> activeGoals = getActiveGoalsForMember(member);

        if (activeGoals.isEmpty()) {
            Map<String, Object> emptyResult = new HashMap<>();
            emptyResult.put("hasActivePlan", false);
            return emptyResult;
        }

        // Find earliest startDate and latest endDate
        LocalDate earliestStart = activeGoals.stream()
                .map(MemberGoal::getStartDate)
                .filter(date -> date != null)
                .min(LocalDate::compareTo)
                .orElse(LocalDate.now().minusMonths(1));

        LocalDate latestEnd = activeGoals.stream()
                .map(MemberGoal::getEndDate)
                .filter(date -> date != null)
                .max(LocalDate::compareTo)
                .orElse(LocalDate.now().plusMonths(1));

        // Fetch all progress records within the plan range
        List<DailyProgress> progressRecords = progressRepository
                .findByMemberAndDateBetween(member, earliestStart, latestEnd);

        // Group by date and check if any goal was completed on each date
        Map<String, Boolean> completions = new HashMap<>();
        for (LocalDate date = earliestStart; !date.isAfter(latestEnd); date = date.plusDays(1)) {
            final LocalDate currentDate = date;
            boolean hasCompletion = progressRecords.stream()
                    .anyMatch(p -> p.getDate().equals(currentDate) && p.isCompleted());
            completions.put(date.toString(), hasCompletion);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("hasActivePlan", true);
        result.put("startDate", earliestStart.toString());
        result.put("endDate", latestEnd.toString());
        result.put("completions", completions);

        return result;
    }

    private Map<String, Object> getWeeklyCategoryStats(User member, List<String> categories, LocalDate targetDate) {
        // Fetch ALL goals for the member to find plan boundaries
        List<MemberGoal> allActiveGoals = goalRepository.findByMemberAndActiveTrue(member);

        // Filter goals that match any of the categories AND were active at some point
        // up
        // to targetDate
        List<MemberGoal> catGoals = allActiveGoals.stream()
                .filter(g -> categories.stream().anyMatch(c -> c.equalsIgnoreCase(g.getCategory())))
                .filter(g -> g.getStartDate() == null || !targetDate.isBefore(g.getStartDate()))
                .collect(Collectors.toList());

        if (catGoals.isEmpty()) {
            Map<String, Object> stats = new HashMap<>();
            stats.put("pct", 0.0);
            stats.put("completed", 0L);
            stats.put("total", 0L);
            return stats;
        }

        // Determine absolute earliest start date among THESE active goals for the
        // progress query
        LocalDate absoluteEarliest = catGoals.stream()
                .map(MemberGoal::getStartDate)
                .filter(java.util.Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(targetDate.minusDays(6)); // Fallback

        long totalPossible = 0;
        for (MemberGoal goal : catGoals) {
            LocalDate effectiveStart = goal.getStartDate() != null ? goal.getStartDate() : absoluteEarliest;
            // A goal contributes to totalPossible from its start date to (min(targetDate,
            // goal.endDate))
            LocalDate effectiveEnd = (goal.getEndDate() != null && goal.getEndDate().isBefore(targetDate))
                    ? goal.getEndDate()
                    : targetDate;

            long days = java.time.temporal.ChronoUnit.DAYS.between(effectiveStart, effectiveEnd) + 1;
            if (days < 1)
                days = 1;
            totalPossible += days;
        }

        // Fetch progress for the entire period (from absolute earliest to target date)
        List<DailyProgress> progress = progressRepository.findByMemberAndDateBetween(member, absoluteEarliest,
                targetDate);

        Set<String> catGoalIds = catGoals.stream().map(MemberGoal::getId).collect(Collectors.toSet());

        long completed = progress.stream()
                .filter(p -> p.isCompleted() && catGoalIds.contains(p.getGoal().getId()))
                .count();

        double pct = totalPossible > 0 ? (completed * 100.0 / totalPossible) : 0.0;

        Map<String, Object> stats = new HashMap<>();
        stats.put("pct", Math.round(pct * 10) / 10.0);
        stats.put("completed", completed);
        stats.put("total", totalPossible);
        return stats;
    }

    /**
     * Bulk delete goals and their associated progress
     */
    public void deleteBulkGoals(List<String> goalIds, User requester) {
        List<MemberGoal> goals = goalRepository.findAllById(goalIds);

        // Validation: Verify requester is either the owner or the trainer of these
        // goals
        List<MemberGoal> authorizedGoals = goals.stream()
                .filter(g -> g.getMember().getId().equals(requester.getId()) ||
                        (g.getTrainer() != null && g.getTrainer().getId().equals(requester.getId())))
                .collect(Collectors.toList());

        if (!authorizedGoals.isEmpty()) {
            // 1. Delete associated daily progress first
            progressRepository.deleteByGoalIn(authorizedGoals);
            // 2. Delete the goals themselves
            goalRepository.deleteAll(authorizedGoals);
            System.out.println("Deleted " + authorizedGoals.size() + " goals and their progress.");
        }
    }
}
