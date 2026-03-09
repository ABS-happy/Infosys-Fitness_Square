package com.fitnesssquare.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DBRef;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "step_logs")
public class StepLog {
    @Id
    private String id;

    @DBRef
    private User user;

    private LocalDate date;
    private Integer steps;
}
