package com.fitnesssquare.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.domain.Sort;

@Configuration
public class MongoConfig {

    @Autowired
    @org.springframework.context.annotation.Lazy
    private MongoTemplate mongoTemplate;

    @Bean
    public CommandLineRunner initializeIndexes() {
        return args -> {
            try {
                // Drop old email-only unique index if it exists
                mongoTemplate.indexOps("users").dropIndex("email_1");
                System.out.println("Dropped old email_1 index successfully.");
            } catch (Exception e) {
                // Index might not exist, which is fine
                System.out.println("Note: email_1 index not found or already dropped.");
            }

            try {
                // Create compound index on email+role (if not exists)
                mongoTemplate.indexOps("users").ensureIndex(
                        new Index()
                                .on("email", Sort.Direction.ASC)
                                .on("role", Sort.Direction.ASC)
                                .unique()
                                .named("email_role_idx"));
                System.out.println("Created compound index (email+role) successfully.");
            } catch (Exception e) {
                // Log the actual error to help debugging
                System.err.println(">>> Error in MongoDB initialization: " + e.getMessage());
                if (e.getMessage().contains("already exists")) {
                    System.out.println("Note: Compound index already exists.");
                }
            }
        };
    }
}
