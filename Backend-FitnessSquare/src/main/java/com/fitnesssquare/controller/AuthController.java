package com.fitnesssquare.controller;

import com.fitnesssquare.dto.LoginRequest;
import com.fitnesssquare.dto.RegisterRequest;
import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.security.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AuthController {

    @jakarta.annotation.PostConstruct
    public void init() {
        System.out.println(">>> AuthController INITIALIZED AND READY!");
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @GetMapping("/ping")
    public ResponseEntity<String> ping() {
        System.out.println(">>> AuthController: Ping received!");
        return ResponseEntity.ok("Auth API is alive!");
    }

    @Autowired
    private com.fitnesssquare.service.EmailService emailService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        System.out.println(">>> Registration attempt for: " + request.getEmail());
        try {
            String role = request.getRole() != null ? request.getRole().toLowerCase() : "member";
            System.out.println(">>> Role: " + role);

            // Check if user with same email AND role already exists
            System.out.println(">>> Checking if user exists...");
            if (userRepository.findByEmailAndRole(request.getEmail(), role).isPresent()) {
                System.out.println(">>> User already exists.");
                Map<String, String> response = new HashMap<>();
                response.put("message", "User with this email and role already registered. Please login.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            if (request.getFullname() == null || request.getFullname().trim().isEmpty()) {
                Map<String, String> response = new HashMap<>();
                response.put("message", "Full Name is required for registration.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }

            User user = new User();
            user.setFullname(request.getFullname());
            user.setEmail(request.getEmail());
            user.setPassword(passwordEncoder.encode(request.getPassword()));
            user.setRole(role);

            // Specialization for trainers
            if ("trainer".equals(role)) {
                if (request.getSpecialization() == null || request.getSpecialization().isBlank()) {
                    Map<String, String> response = new HashMap<>();
                    response.put("message", "Specialization is required for trainers");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
                }

                // Validate against allowed list
                List<String> allowedSpecializations = java.util.Arrays.asList(
                        "Weight Loss", "Muscle Gain", "General Fitness", "Strength Training",
                        "Cardio Training", "Yoga & Flexibility", "Diabetes Management",
                        "Heart Health", "Women Fitness", "Senior Fitness", "Post Injury Rehab");

                if (!allowedSpecializations.contains(request.getSpecialization())) {
                    Map<String, String> response = new HashMap<>();
                    response.put("message", "Invalid specialization selected");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
                }
                user.setSpecialization(request.getSpecialization());
                user.setFitnessGoals(null);
                user.setPrimaryGoal(null);
            } else {
                // For members and admins, ensure fields are null initially
                user.setSpecialization(null);
                user.setFitnessGoals(null);
                user.setPrimaryGoal(null);
            }

            // Email verification logic
            if ("admin".equals(role) || "trainer".equals(role)) {
                user.setEmailVerified(true);
            } else {
                user.setEmailVerified(false);
                // Send OTP for members
                String otp = emailService.generateOtp();
                emailService.saveOtp(user.getEmail(), otp);
                emailService.sendOtpEmail(user.getEmail(), otp);
            }

            user.setActive(true);
            user.setUsernameSet(true);

            System.out.println(">>> Saving user to database...");
            userRepository.save(user);
            System.out.println(">>> User saved successfully.");

            Map<String, String> response = new HashMap<>();
            String message = "User registered successfully as " + role;
            if (!user.isEmailVerified()) {
                message += ". Please verify your email with the OTP sent.";
            }
            response.put("message", message);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception e) {
            System.err.println(">>> Registration FAILED for " + request.getEmail());
            e.printStackTrace();
            Map<String, String> response = new HashMap<>();
            response.put("message", "Registration failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        System.out.println(">>> Login attempt for email: " + request.getEmail());
        try {
            Optional<User> userOpt;

            // If role is specified, find by email AND role
            if (request.getRole() != null && !request.getRole().isEmpty()) {
                String role = request.getRole().toLowerCase();
                System.out.println(">>> Finding user by email and role: " + role);
                userOpt = userRepository.findByEmailAndRole(request.getEmail(), role);

                if (userOpt.isEmpty()) {
                    System.out.println(">>> Error: No user found with this role.");
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(Map.of("message",
                                    "No " + role + " account found with this email. Please register first."));
                }
            } else {
                // If no role specified, find any user with this email
                System.out.println(">>> Finding user by email only.");
                userOpt = userRepository.findByEmail(request.getEmail());

                if (userOpt.isEmpty()) {
                    System.out.println(">>> Error: User not registered.");
                    return ResponseEntity.status(HttpStatus.NOT_FOUND)
                            .body(Map.of("message", "User not registered. Please register first."));
                }
            }

            User user = userOpt.get();

            if (!user.isActive()) {
                System.out.println(">>> Error: Account deactivated.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Account deactivated"));
            }

            if (!user.isEmailVerified()) {
                System.out.println(">>> Warning: Email not verified. Sending 403.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Please verify your email first"));
            }

            if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                System.out.println(">>> Error: Invalid password.");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid credentials"));
            }

            System.out.println(">>> Login successful. Updating status and generating token.");
            user.setHasLoggedIn(true);
            userRepository.save(user);

            String token = jwtUtils.generateToken(user.getId(), user.getEmail(), user.getRole());

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);

            Map<String, Object> userData = new HashMap<>();
            userData.put("id", user.getId());
            userData.put("fullname", user.getFullname());
            userData.put("email", user.getEmail());
            userData.put("role", user.getRole());

            response.put("user", userData);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println(">>> Login CRITICAL ERROR: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Server error during login: " + e.getMessage()));
        }
    }

    @GetMapping("/verify-token")
    public ResponseEntity<?> verifyToken(@RequestHeader("Authorization") String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        if (jwtUtils.validateToken(token)) {
            Map<String, Object> response = new HashMap<>();
            response.put("valid", true);
            response.put("user", jwtUtils.getClaims(token));
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid token");
    }
}
