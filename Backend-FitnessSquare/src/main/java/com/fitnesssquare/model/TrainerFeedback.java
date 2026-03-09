package com.fitnesssquare.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "trainer_feedback")
@CompoundIndex(name = "user_trainer_idx", def = "{'user': 1, 'trainer': 1}", unique = true)
public class TrainerFeedback {
    @Id
    private String id;

    @DBRef
    private User trainer;

    @DBRef
    private User user;

    private int rating; // 1-5
    private String comment;
    private LocalDateTime timestamp;
}
