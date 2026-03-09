package com.fitnesssquare.service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fitnesssquare.model.User;
import com.fitnesssquare.model.WeightLog;
import com.fitnesssquare.repository.WeightLogRepository;

import com.fitnesssquare.repository.WaterLogRepository;
import com.fitnesssquare.repository.SleepLogRepository;
import com.fitnesssquare.model.WaterLog;
import com.fitnesssquare.model.SleepLog;

@Service
public class GoalEffectivenessService {

    @Autowired
    private WeightLogRepository weightLogRepository;

    @Autowired
    private WaterLogRepository waterLogRepository;

    @Autowired
    private SleepLogRepository sleepLogRepository;

    public Map<String, Object> calculatePlanEffectiveness(User user) {
        Map<String, Object> result = new HashMap<>();

        LocalDate today = LocalDate.now();
        LocalDate fourteenDaysAgoLimit = today.minusDays(13); // Total 14 days [today-13, today]
        LocalDate sevenDaysAgoLimit = today.minusDays(6); // Current window starts 6 days ago

        // Fetch weight logs for the last 14 days
        List<WeightLog> allLogs = weightLogRepository.findByUserAndDateBetween(user, fourteenDaysAgoLimit, today);

        // Get starting weight context (earliest log ever)
        Double startingWeight = weightLogRepository.findFirstByUserOrderByDateAsc(user)
                .map(WeightLog::getWeight)
                .orElse(null);
        result.put("startingWeight", startingWeight);

        if (allLogs.size() < 7) {
            result.put("effectiveness", "Not enough data");
            result.put("message", "Log weight consistently for at least 7 days to trigger advanced analysis.");
            return result;
        }

        // Calculate current 7-day average (Today - 6 days)
        double currentAvg = allLogs.stream()
                .filter(log -> !log.getDate().isBefore(sevenDaysAgoLimit))
                .mapToDouble(WeightLog::getWeight)
                .average()
                .orElse(0.0);

        // Calculate previous 7-day average (Today-13 to Today-7)
        double previousAvg = allLogs.stream()
                .filter(log -> log.getDate().isBefore(sevenDaysAgoLimit))
                .mapToDouble(WeightLog::getWeight)
                .average()
                .orElse(currentAvg);

        double change = currentAvg - previousAvg;
        String trend;

        if (Math.abs(change) < 0.5) {
            trend = "stable";
        } else if (change > 0) {
            trend = "increase";
        } else {
            trend = "decrease";
        }

        // Evaluate based on primary goal
        String primaryGoal = user.getPrimaryGoal();
        if (primaryGoal == null || primaryGoal.isEmpty()) {
            if (user.getFitnessGoals() != null && !user.getFitnessGoals().isEmpty()) {
                primaryGoal = user.getFitnessGoals().get(0);
            }
        }

        String effectiveness;
        String message;
        String insight = "";

        if (primaryGoal == null || primaryGoal.isEmpty()) {
            effectiveness = "No primary goal set";
            message = "Set your primary goal to see advice tailored exactly to you.";
        } else {
            String goalLower = primaryGoal.toLowerCase().replace("_", " ");

            // Analyze habits for the last 7 days to inject smart advice
            List<WaterLog> recentWaterLogs = waterLogRepository.findByUserAndLogDateBetween(user, sevenDaysAgoLimit,
                    today);
            long daysMetWater = recentWaterLogs.stream()
                    .filter(log -> log.getWaterIntake() != null && log
                            .getWaterIntake()
                            .doubleValue() >= (user.getTargetWaterLiters() != null ? user.getTargetWaterLiters() : 2.5))
                    .count();

            List<SleepLog> recentSleepLogs = sleepLogRepository.findByUserAndSleepDateBetween(user, sevenDaysAgoLimit,
                    today);
            long daysMetSleep = recentSleepLogs.stream()
                    .filter(log -> log.getSleepHours() != null && log
                            .getSleepHours()
                            .doubleValue() >= (user.getTargetSleepHours() != null ? user.getTargetSleepHours() : 7.0))
                    .count();

            if (goalLower.contains("weight loss") || goalLower.contains("lose weight")) {
                if (trend.equals("decrease")) {
                    effectiveness = "Plan working well";
                    message = String.format(
                            "🔥 Great job! You've lost %.1fkg on average this week. This perfectly aligns with your Weight Loss goal. Keep following your program!",
                            Math.abs(change));
                } else if (trend.equals("stable")) {
                    effectiveness = "Plateau Detected";
                    message = "📊 Weight is currently stable. Don't panic! Weight loss naturally plateaus. Ensure you are actually hitting your Calorie Deficit targets daily.";
                    if (daysMetSleep <= 3)
                        insight = "😴 Insight: Poor sleep this week might be increasing cortisol and halting fat loss. Get more rest!";
                } else {
                    effectiveness = "Trending Upwards";
                    message = String.format(
                            "⚠️ Your weight trended up slightly by %.1fkg this week. Weight naturally fluctuates, but review your Calorie Deficit calculator to be sure.",
                            Math.abs(change));
                    if (daysMetWater <= 3)
                        insight = "💧 Insight: You missed your water goal several times. Dehydration causes the body to retain water, temporarily masking true weight loss. Drink up!";
                }
            } else if (goalLower.contains("muscle gain") || goalLower.contains("build muscle")) {
                if (trend.equals("increase") && change < 1.0) {
                    effectiveness = "Perfect Progress";
                    message = String.format(
                            "💪 Excellent! You're trending upwards by %.1fkg. This slow, steady gain supports your Muscle Building goals wonderfully. Hit that protein!",
                            change);
                } else if (trend.equals("increase") && change >= 1.0) {
                    effectiveness = "Rapid Gain";
                    message = "⚠️ You gained weight quite rapidly this week. Ensure it's muscle, not fat, by keeping your caloric surplus very slight and maximizing resistance training.";
                } else if (trend.equals("stable")) {
                    effectiveness = "Increase Calories";
                    message = "📊 Weight is totally stable. To build muscle, you need a caloric surplus. Try increasing your daily intake slightly over your maintenance calories.";
                    if (daysMetSleep <= 3)
                        insight = "😴 Insight: Your sleep score dropped. Muscles are built during deep sleep, not in the gym! Prioritize rest this weekend.";
                } else {
                    effectiveness = "Insufficient Intake";
                    message = "🔻 Weight is decreasing. You cannot build optimal muscle while losing weight. You MUST increase your daily calories and protein.";
                }
            } else if (goalLower.contains("maintain") || goalLower.contains("maintenance")
                    || goalLower.contains("general fitness")) {
                if (trend.equals("stable")) {
                    effectiveness = "Weight stable";
                    message = "🌟 Perfect! Your weight is maintaining beautifully within your target zone.";
                } else {
                    effectiveness = "Imbalance detected";
                    message = "⚠️ Your weight is drifting slightly. Adjust your daily calories back to your maintenance level measured in the Calorie Calculator.";
                }
            } else if (goalLower.contains("injury recovery")) {
                if (trend.equals("stable") || (trend.equals("increase") && change < 1.0)) {
                    effectiveness = "Steady recovery";
                    message = "❤️ Weight is stable, providing an excellent foundation for healing. Keep focusing on high-quality nutrient-dense foods.";
                } else if (trend.equals("decrease") && change <= -1.0) {
                    effectiveness = "Monitor intake";
                    message = "⚠️ Losing significant weight during recovery can accidentally slow down the healing process depending on your injury. Ensure adequate protein intake to rebuild tissue.";
                } else {
                    effectiveness = "Gaining too fast";
                    message = "⚠️ Rapid weight gain detected. This can happen when your physical activity drops suddenly due to injury. Moderately drop calories to match your new temporary activity level.";
                }
            } else {
                if (trend.equals("stable")) {
                    effectiveness = "Weight stable";
                    message = "Your weight is completely stable.";
                } else if (trend.equals("increase")) {
                    effectiveness = "Weight increasing";
                    message = String.format("Your weight has trended upwards by %.1fkg recently.", change);
                } else {
                    effectiveness = "Weight decreasing";
                    message = String.format("Your weight has trended downwards by %.1fkg recently.", Math.abs(change));
                }
            }
        }

        result.put("effectiveness", effectiveness);
        result.put("message", message);
        if (!insight.isEmpty()) {
            result.put("insight", insight);
        }
        result.put("currentAvg", Math.round(currentAvg * 10.0) / 10.0);
        result.put("previousAvg", Math.round(previousAvg * 10.0) / 10.0);
        result.put("trend", trend);
        result.put("change", Math.round(change * 10.0) / 10.0);

        // Add history for graph plotting
        List<Map<String, Object>> history = new java.util.ArrayList<>();
        for (WeightLog log : allLogs) {
            Map<String, Object> dataPoint = new HashMap<>();
            dataPoint.put("date", log.getDate().toString());
            dataPoint.put("weight", log.getWeight());
            history.add(dataPoint);
        }

        history.sort((a, b) -> ((String) a.get("date")).compareTo((String) b.get("date")));
        result.put("history", history);

        return result;
    }
}
