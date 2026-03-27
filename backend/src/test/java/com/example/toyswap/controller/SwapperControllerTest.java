package com.example.toyswap.controller;

import com.example.toyswap.model.Swapper;
import com.example.toyswap.repository.SwapperRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class SwapperControllerTest {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;

    @MockitoBean
    private SwapperRepository swapperRepository;

    @MockitoBean
    private BCryptPasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    private Swapper buildSwapper(String userId) {
        Swapper s = new Swapper();
        s.setUserId(userId);
        s.setFirstName("Alice");
        s.setLastName("Smith");
        s.setUsername("asmith_" + userId);
        s.setPassword("secret");
        s.setZipCode("12345");
        return s;
    }

    private String swapperJson(String userId) {
        return """
                {
                    "userId": "%s",
                    "firstName": "Alice",
                    "lastName": "Smith",
                    "username": "asmith_%s",
                    "password": "secret",
                    "zipCode": "12345"
                }
                """.formatted(userId, userId);
    }

    @Test
    void getAllSwappers_returnsEmptyList() throws Exception {
        given(swapperRepository.findAll()).willReturn(List.of());

        mockMvc.perform(get("/api/swappers"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
    }

    @Test
    void getAllSwappers_returnsAllSwappers() throws Exception {
        given(swapperRepository.findAll()).willReturn(List.of(buildSwapper("u1"), buildSwapper("u2")));

        mockMvc.perform(get("/api/swappers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void getSwapperById_found_returns200WithBody() throws Exception {
        given(swapperRepository.findById("u1")).willReturn(Optional.of(buildSwapper("u1")));

        mockMvc.perform(get("/api/swappers/u1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("u1"))
                .andExpect(jsonPath("$.firstName").value("Alice"))
                .andExpect(jsonPath("$.lastName").value("Smith"));
    }

    @Test
    void getSwapperById_notFound_returns404() throws Exception {
        given(swapperRepository.findById("ghost")).willReturn(Optional.empty());

        mockMvc.perform(get("/api/swappers/ghost"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createSwapper_newUser_returns201() throws Exception {
        given(swapperRepository.existsById("u1")).willReturn(false);
        given(passwordEncoder.encode("secret")).willReturn("$2a$10$hashedvalue");
        given(swapperRepository.save(any(Swapper.class))).willReturn(buildSwapper("u1"));

        mockMvc.perform(post("/api/swappers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(swapperJson("u1")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value("u1"))
                .andExpect(jsonPath("$.firstName").value("Alice"));
    }

    @Test
    void createSwapper_duplicateUserId_returns409() throws Exception {
        given(swapperRepository.existsById("u1")).willReturn(true);

        mockMvc.perform(post("/api/swappers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(swapperJson("u1")))
                .andExpect(status().isConflict());
    }

    @Test
    void updateSwapper_exists_returns200WithUpdatedBody() throws Exception {
        given(swapperRepository.existsById("u1")).willReturn(true);
        given(swapperRepository.save(any(Swapper.class))).willReturn(buildSwapper("u1"));

        mockMvc.perform(put("/api/swappers/u1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(swapperJson("u1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("u1"));
    }

    @Test
    void updateSwapper_notFound_returns404() throws Exception {
        given(swapperRepository.existsById("ghost")).willReturn(false);

        mockMvc.perform(put("/api/swappers/ghost")
                .contentType(MediaType.APPLICATION_JSON)
                .content(swapperJson("ghost")))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteSwapper_exists_returns204() throws Exception {
        given(swapperRepository.existsById("u1")).willReturn(true);

        mockMvc.perform(delete("/api/swappers/u1"))
                .andExpect(status().isNoContent());

        verify(swapperRepository).deleteById("u1");
    }

    @Test
    void deleteSwapper_notFound_returns404() throws Exception {
        given(swapperRepository.existsById("ghost")).willReturn(false);

        mockMvc.perform(delete("/api/swappers/ghost"))
                .andExpect(status().isNotFound());
    }

    // ── Login tests ───────────────────────────────────────────────────────────

    @Test
    void login_validCredentials_returns200WithoutPassword() throws Exception {
        Swapper stored = buildSwapper("u1");
        stored.setPassword("$2a$10$hashedvalue");
        given(swapperRepository.findByUsername("asmith_u1"))
                .willReturn(java.util.Optional.of(stored));
        given(passwordEncoder.matches("secret", "$2a$10$hashedvalue")).willReturn(true);

        mockMvc.perform(post("/api/swappers/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"asmith_u1\",\"password\":\"secret\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("u1"))
                .andExpect(jsonPath("$.firstName").value("Alice"))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void login_wrongPassword_returns401() throws Exception {
        Swapper stored = buildSwapper("u1");
        stored.setPassword("$2a$10$hashedvalue");
        given(swapperRepository.findByUsername("asmith_u1"))
                .willReturn(java.util.Optional.of(stored));
        given(passwordEncoder.matches("wrong", "$2a$10$hashedvalue")).willReturn(false);

        mockMvc.perform(post("/api/swappers/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"asmith_u1\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_missingUsername_returns400() throws Exception {
        mockMvc.perform(post("/api/swappers/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"secret\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void login_missingPassword_returns400() throws Exception {
        mockMvc.perform(post("/api/swappers/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"asmith_u1\"}"))
                .andExpect(status().isBadRequest());
    }
}
