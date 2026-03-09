package com.fitnesssquare.dto;

import lombok.Data;

@Data
public class LoginRequest {
    private String email;
    private String password;
    private String role; // Optional: specify role to login as (member/trainer/admin)
}
