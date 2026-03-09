package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "blog_posts")
public class BlogPost {
    @Id
    private String id;

    private String title;
    private String content;
    private String authorId;
    private String authorName;
    private String authorRole; // TRAINER, ADMIN, MEMBER

    private List<String> tags = new ArrayList<>();
    private String imageUrl;

    // Status: PENDING, PUBLISHED, REJECTED
    private String status = "PENDING";

    private boolean archived = false;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();

    private List<String> likes = new ArrayList<>(); // List of user IDs who liked the post
    private int reportCount = 0;
}
