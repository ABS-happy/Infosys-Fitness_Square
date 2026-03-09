package com.fitnesssquare.service;

import com.fitnesssquare.model.OtpVerification;
import com.fitnesssquare.repository.OtpVerificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private OtpVerificationRepository otpVerificationRepository;

    public String generateOtp() {
        return String.valueOf((int) (Math.random() * 900000) + 100000);
    }

    public void sendOtpEmail(String email, String otp) {
        System.out.println(">>> DEBUG: Sending OTP " + otp + " to email: " + email);
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("Fitness Square <" + System.getProperty("MAIL_USERNAME") + ">");
            message.setTo(email);
            message.setSubject("Fitness Square OTP Verification");
            message.setText("Your OTP is: " + otp + "\nValid for 5 minutes.");
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("CRITICAL: Failed to send email to " + email
                    + ". Ensure MAIL_USERNAME and MAIL_PASSWORD are set in .env");
            e.printStackTrace();
        }
    }

    public void saveOtp(String email, String otp) {
        OtpVerification verification = otpVerificationRepository.findByEmail(email)
                .orElse(new OtpVerification());

        verification.setEmail(email);
        verification.setOtp(otp);
        verification.setExpiryTime(LocalDateTime.now().plusMinutes(5));
        verification.setVerified(false);
        verification.setLastSentAt(LocalDateTime.now());

        otpVerificationRepository.save(verification);
    }
}
