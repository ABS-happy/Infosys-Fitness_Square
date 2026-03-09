package com.fitnesssquare.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "otp_verifications")
public class OtpVerification {
    @Id
    private String id;
    private String email;
    private String otp;
    private LocalDateTime expiryTime;
    private boolean verified;
    private LocalDateTime lastSentAt;
}
