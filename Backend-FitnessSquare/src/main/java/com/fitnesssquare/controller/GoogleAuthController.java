package com.fitnesssquare.controller;

import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.security.JwtUtils;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class GoogleAuthController {

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/test")
    public ResponseEntity<String> test() {
        System.out.println(">>> GoogleAuthController: Test received!");
        return ResponseEntity.ok("Google Auth API is alive!");
    }

    @Autowired
    private JwtUtils jwtUtils;

    @Value("${GOOGLE_CLIENT_ID:}")
    private String googleClientId;

    private GoogleIdTokenVerifier verifier;
    private final NetHttpTransport transport = new NetHttpTransport();
    private final GsonFactory jsonFactory = new GsonFactory();

    private synchronized GoogleIdTokenVerifier getVerifier() {
        if (verifier == null && googleClientId != null && !googleClientId.isEmpty()) {
            verifier = new GoogleIdTokenVerifier.Builder(transport, jsonFactory)
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();
        }
        return verifier;
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleSignIn(@RequestBody Map<String, String> body) {
        String idTokenString = body.get("token");
        System.out.println(">>> Backend: Received Google Sign-In request");

        if (idTokenString == null) {
            System.err.println(">>> Backend Error: Token is missing in request body");
            return ResponseEntity.badRequest().body(Map.of("message", "Token is required"));
        }

        if (googleClientId == null || googleClientId.isEmpty()) {
            System.err.println(">>> Backend Error: GOOGLE_CLIENT_ID is not set in Environment");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Google Client ID not configured on server. Please check .env file."));
        }

        System.out.println(">>> Backend: Using Client ID: " + googleClientId);

        try {
            GoogleIdTokenVerifier verifier = getVerifier();
            if (verifier == null) {
                System.err.println(">>> Backend Error: Verifier initialization failed (check Client ID)");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("message", "Google Auth Verifier not initialized."));
            }

            System.out.println(">>> Backend: Verifying token...");
            GoogleIdToken idToken = verifier.verify(idTokenString);
            if (idToken != null) {
                Payload payload = idToken.getPayload();
                String email = payload.getEmail();
                String name = (String) payload.get("name");
                if (name == null || name.isEmpty()) {
                    name = email.split("@")[0]; // Fallback to email prefix
                }
                System.out.println(">>> Backend: Token verified for: " + email);

                User user = null;
                try {
                    Optional<User> userOpt = userRepository.findByEmail(email);
                    if (userOpt.isEmpty()) {
                        System.out.println(">>> Backend: Creating new user for: " + email);
                        user = new User();
                        user.setEmail(email);
                        user.setFullname(name);
                        user.setRole("member");
                        user.setEmailVerified(true);
                        user.setActive(true);
                        user.setUsernameSet(true);
                        userRepository.save(user);
                    } else {
                        user = userOpt.get();
                        System.out.println(">>> Backend: Existing user found: " + email);
                        if (!user.isEmailVerified()) {
                            user.setEmailVerified(true);
                            userRepository.save(user);
                        }
                    }
                } catch (Exception dbEx) {
                    System.err.println(">>> DATABASE ERROR: Could not reach MongoDB. Using fail-safe fallback.");
                    dbEx.printStackTrace();
                    // Fail-safe: Create a volatile temporary user object so the dashboard can open
                    user = new User();
                    user.setId("temp-id-" + System.currentTimeMillis());
                    user.setEmail(email);
                    user.setFullname(name);
                    user.setRole("member");
                }

                String token = jwtUtils.generateToken(user.getId(), user.getEmail(), user.getRole());
                Map<String, Object> response = new HashMap<>();
                response.put("token", token);
                response.put("db_status", "offline_fail_safe");

                Map<String, Object> userData = new HashMap<>();
                userData.put("id", user.getId());
                userData.put("fullname", user.getFullname());
                userData.put("email", user.getEmail());
                userData.put("role", user.getRole());
                response.put("user", userData);

                return ResponseEntity.ok(response);
            } else {
                System.err.println(
                        ">>> Backend Error: verifier.verify() returned NULL. Check Client ID and token validity.");
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Invalid Google ID token. Please try again or re-login to Google."));
            }
        } catch (Throwable e) {
            System.err.println(">>> Backend Error: Fatal error during verification: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message",
                            "Backend Google Auth Fatal Error: " + e.getClass().getName() + " - " + e.getMessage()));
        }
    }
}
