package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "comments")
public class Comment {
    @Id
    private String id;

    private String postId;
    private String userId;
    private String userName;
    private String content;

    private LocalDateTime createdAt = LocalDateTime.now();

    // Status: PENDING, PUBLISHED (if comments need moderation)
    // For now, let's assume comments are published immediately but can be
    // reported/hidden
    private String status = "PUBLISHED";

    private int reportCount = 0;
}
