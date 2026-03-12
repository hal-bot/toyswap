package com.example.toyswap.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class SwapperTest {

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    }

    @Test
    void settersAndGetters_workCorrectly() {
        Swapper swapper = new Swapper();
        swapper.setUserId("user1");
        swapper.setFirstName("Alice");
        swapper.setLastName("Smith");
        swapper.setUsername("asmith");
        swapper.setPassword("secret");
        swapper.setZipCode("12345");
        swapper.setBirthday(LocalDate.of(1990, 6, 15));

        assertThat(swapper.getUserId()).isEqualTo("user1");
        assertThat(swapper.getFirstName()).isEqualTo("Alice");
        assertThat(swapper.getLastName()).isEqualTo("Smith");
        assertThat(swapper.getUsername()).isEqualTo("asmith");
        assertThat(swapper.getPassword()).isEqualTo("secret");
        assertThat(swapper.getZipCode()).isEqualTo("12345");
        assertThat(swapper.getBirthday()).isEqualTo(LocalDate.of(1990, 6, 15));
    }

    @Test
    void serialization_passwordIsNotIncluded() throws Exception {
        Swapper swapper = new Swapper();
        swapper.setUserId("user1");
        swapper.setPassword("secret");

        String json = objectMapper.writeValueAsString(swapper);

        assertThat(json).doesNotContain("password");
        assertThat(json).doesNotContain("secret");
    }

    @Test
    void serialization_birthdayFormattedAsMMddYYYY() throws Exception {
        Swapper swapper = new Swapper();
        swapper.setBirthday(LocalDate.of(1990, 6, 15));

        String json = objectMapper.writeValueAsString(swapper);

        assertThat(json).contains("06/15/1990");
    }

    @Test
    void deserialization_birthdayParsedFromMMddYYYY() throws Exception {
        String json = "{\"userId\":\"u1\",\"firstName\":\"Alice\",\"lastName\":\"Smith\"," +
                "\"birthday\":\"06/15/1990\",\"username\":\"asmith\",\"password\":\"pw\",\"zipCode\":\"12345\"}";

        Swapper swapper = objectMapper.readValue(json, Swapper.class);

        assertThat(swapper.getBirthday()).isEqualTo(LocalDate.of(1990, 6, 15));
    }

    @Test
    void deserialization_passwordIsPopulatedFromJson() throws Exception {
        String json = "{\"userId\":\"u1\",\"firstName\":\"Alice\",\"lastName\":\"Smith\"," +
                "\"username\":\"asmith\",\"password\":\"secret\",\"zipCode\":\"12345\"}";

        Swapper swapper = objectMapper.readValue(json, Swapper.class);

        assertThat(swapper.getPassword()).isEqualTo("secret");
    }
}
