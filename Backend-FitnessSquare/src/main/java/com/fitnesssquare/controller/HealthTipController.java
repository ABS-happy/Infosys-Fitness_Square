package com.fitnesssquare.controller;

import com.fitnesssquare.model.User;
import com.fitnesssquare.repository.UserRepository;
import com.fitnesssquare.security.JwtUtils;
import com.fitnesssquare.service.HealthTipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health-tip")
@CrossOrigin(origins = "*")
public class HealthTipController {

    @Autowired
    private HealthTipService healthTipService;
    @Autowired
    private JwtUtils jwtUtils;
    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getTip(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Map<String, String> tip;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.replace("Bearer ", "");
            String email = jwtUtils.getEmailFromToken(token);
            String role = (String) jwtUtils.getClaims(token).get("role");
            User user = userRepository.findByEmailAndRole(email, role).orElse(null);
            if (user != null) {
                tip = healthTipService.getPersonalizedTip(user);
            } else {
                tip = healthTipService.getTipOfTheDay();
            }
        } else {
            tip = healthTipService.getTipOfTheDay();
        }

        return ResponseEntity.ok(tip);
    }
}
