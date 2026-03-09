package com.fitnesssquare.controller;

import com.fitnesssquare.model.OtpVerification;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.OtpVerificationRepository;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/otp")
public class OtpController {

    @Autowired
    private EmailService emailService;

    @Autowired
    private OtpVerificationRepository otpVerificationRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping("/send")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        System.out.println(">>> OTP: Requesting send for: " + email);
        try {
            String otp = emailService.generateOtp();
            emailService.saveOtp(email, otp);
            emailService.sendOtpEmail(email, otp);
            System.out.println(">>> OTP: Sent successfully to " + email);
            return ResponseEntity.ok(Map.of("message", "OTP sent successfully"));
        } catch (Exception e) {
            System.err.println(">>> OTP Send ERROR: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of("message", "Failed to send OTP: " + e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String otp = request.get("otp");
        System.out.println(">>> OTP: Verifying for: " + email + " with OTP: " + otp);

        try {
            OtpVerification verification = otpVerificationRepository.findByEmail(email)
                    .orElse(null);

            if (verification == null) {
                System.err.println(">>> OTP Error: No verification record found for " + email);
                return ResponseEntity.badRequest().body(Map.of("message", "No OTP record found. Please resend OTP."));
            }

            if (verification.getExpiryTime().isBefore(LocalDateTime.now())) {
                System.err.println(">>> OTP Error: OTP expired.");
                return ResponseEntity.badRequest().body(Map.of("message", "OTP expired. Please resend."));
            }

            if (!verification.getOtp().equals(otp)) {
                System.err.println(">>> OTP Error: Invalid OTP provided.");
                return ResponseEntity.badRequest().body(Map.of("message", "Invalid OTP. Please check your email."));
            }

            verification.setVerified(true);
            otpVerificationRepository.save(verification);

            // ✅ Mark user as verified
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                System.err.println(">>> OTP Error: User not found despite valid OTP.");
                return ResponseEntity.status(404).body(Map.of("message", "User record lost. Please register again."));
            }

            user.setEmailVerified(true);
            userRepository.save(user);

            System.out.println(">>> OTP: Verification successful for: " + email);
            return ResponseEntity.ok(Map.of("message", "OTP verified successfully. You can now login."));
        } catch (Exception e) {
            System.err.println(">>> OTP Verify CRITICAL ERROR: " + e.getMessage());
            return ResponseEntity.status(500)
                    .body(Map.of("message", "Verification failed on server: " + e.getMessage()));
        }
    }
}
