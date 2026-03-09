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
@Document(collection = "water_logs")
public class WaterLog {
    @Id
    private String id;
    private BigDecimal waterIntake;
    private String notes;
    private LocalDate logDate;

    @DBRef
    private User user;
}
