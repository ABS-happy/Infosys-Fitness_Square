package com.fitnesssquare.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DBRef;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sleep_logs")
public class SleepLog {
    @Id
    private String id;
    private BigDecimal sleepHours;
    private String notes;
    private LocalDate sleepDate;

    @DBRef
    private User user;
}
