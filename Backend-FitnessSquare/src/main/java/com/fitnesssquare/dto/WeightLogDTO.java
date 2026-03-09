package com.fitnesssquare.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WeightLogDTO {

    @NotNull(message = "Date cannot be null")
    private String date;

    @NotNull(message = "Weight cannot be null")
    @Min(value = 20, message = "Weight must be at least 20kg")
    @Max(value = 300, message = "Weight must be at most 300kg")
    private Double weight;
}
