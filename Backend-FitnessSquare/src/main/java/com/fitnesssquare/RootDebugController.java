package com.fitnesssquare;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RootDebugController {

    @GetMapping("/debug-ping")
    public ResponseEntity<String> debugPing() {
        System.out.println(">>> RootDebugController: Ping received!");
        return ResponseEntity.ok("Root API is alive and scanning works!");
    }
}
