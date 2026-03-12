package com.example.toyswap.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "item")
public class Item {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Valid values: toy, book, misc
    @Column(name = "type")
    private String type;

    @Column(name = "name", nullable = false)
    private String name;

    // Valid values: new, lite wear, medium wear, heavy wear
    @Column(name = "condition")
    private String condition;

    @Column(name = "require_batteries")
    private boolean requireBatteries;

    @Column(name = "when_purchased")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "MM/dd/yyyy")
    private LocalDate whenPurchased;

    @Column(name = "estimated_value")
    private float estimatedValue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_owner_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler", "password" })
    private Swapper currentOwner;

    // Valid values: baby, crawler, toddler, child, kid
    @Column(name = "age_level")
    private String ageLevel;

    public Item() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCondition() {
        return condition;
    }

    public void setCondition(String condition) {
        this.condition = condition;
    }

    public boolean isRequireBatteries() {
        return requireBatteries;
    }

    public void setRequireBatteries(boolean requireBatteries) {
        this.requireBatteries = requireBatteries;
    }

    public LocalDate getWhenPurchased() {
        return whenPurchased;
    }

    public void setWhenPurchased(LocalDate whenPurchased) {
        this.whenPurchased = whenPurchased;
    }

    public float getEstimatedValue() {
        return estimatedValue;
    }

    public void setEstimatedValue(float estimatedValue) {
        this.estimatedValue = estimatedValue;
    }

    public Swapper getCurrentOwner() {
        return currentOwner;
    }

    public void setCurrentOwner(Swapper currentOwner) {
        this.currentOwner = currentOwner;
    }

    public String getAgeLevel() {
        return ageLevel;
    }

    public void setAgeLevel(String ageLevel) {
        this.ageLevel = ageLevel;
    }
}
