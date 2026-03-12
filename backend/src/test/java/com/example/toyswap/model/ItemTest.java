package com.example.toyswap.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class ItemTest {

    @Test
    void settersAndGetters_workCorrectly() {
        Swapper owner = new Swapper();
        owner.setUserId("user1");

        Item item = new Item();
        item.setId(1L);
        item.setType("toy");
        item.setName("Lego Set");
        item.setCondition("new");
        item.setRequireBatteries(false);
        item.setWhenPurchased(LocalDate.of(2024, 12, 25));
        item.setEstimatedValue(29.99f);
        item.setCurrentOwner(owner);
        item.setAgeLevel("child");

        assertThat(item.getId()).isEqualTo(1L);
        assertThat(item.getType()).isEqualTo("toy");
        assertThat(item.getName()).isEqualTo("Lego Set");
        assertThat(item.getCondition()).isEqualTo("new");
        assertThat(item.isRequireBatteries()).isFalse();
        assertThat(item.getWhenPurchased()).isEqualTo(LocalDate.of(2024, 12, 25));
        assertThat(item.getEstimatedValue()).isEqualTo(29.99f);
        assertThat(item.getCurrentOwner()).isEqualTo(owner);
        assertThat(item.getAgeLevel()).isEqualTo("child");
    }

    @Test
    void requireBatteries_defaultIsFalse() {
        assertThat(new Item().isRequireBatteries()).isFalse();
    }

    @Test
    void requireBatteries_canBeSetToTrue() {
        Item item = new Item();
        item.setRequireBatteries(true);
        assertThat(item.isRequireBatteries()).isTrue();
    }

    @Test
    void estimatedValue_canBeSetToZero() {
        Item item = new Item();
        item.setEstimatedValue(0.0f);
        assertThat(item.getEstimatedValue()).isEqualTo(0.0f);
    }

    @Test
    void currentOwner_defaultIsNull() {
        assertThat(new Item().getCurrentOwner()).isNull();
    }
}
