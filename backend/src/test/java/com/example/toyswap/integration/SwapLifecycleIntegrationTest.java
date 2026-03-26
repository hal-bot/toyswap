package com.example.toyswap.integration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests that hit the real controller → service → JPA → H2 stack.
 * No mocks — validates the full request lifecycle.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Transactional
class SwapLifecycleIntegrationTest {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void createSwapper(String userId, String username, String password) throws Exception {
        String json = """
                {
                    "userId": "%s",
                    "firstName": "Test",
                    "lastName": "User",
                    "username": "%s",
                    "password": "%s",
                    "zipCode": "12345"
                }
                """.formatted(userId, username, password);

        mockMvc.perform(post("/api/swappers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isCreated());
    }

    private long createItem(String ownerId, String name, String type) throws Exception {
        String json = """
                {
                    "name": "%s",
                    "type": "%s",
                    "ageLevel": "child",
                    "description": "integration test item"
                }
                """.formatted(name, type);

        MvcResult result = mockMvc.perform(post("/api/items")
                .param("ownerId", ownerId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isCreated())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        Matcher m = Pattern.compile("\"id\":(\\d+)").matcher(responseBody);
        if (!m.find()) {
            throw new AssertionError("No id found in response: " + responseBody);
        }
        return Long.parseLong(m.group(1));
    }

    // ── Tests ────────────────────────────────────────────────────────────────

    @Test
    void registerAndLogin_bcryptRoundTrip() throws Exception {
        createSwapper("int_alice", "alice_int", "mySecret123");

        // Login with correct password succeeds
        mockMvc.perform(post("/api/swappers/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alice_int\",\"password\":\"mySecret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("int_alice"))
                .andExpect(jsonPath("$.password").doesNotExist());

        // Login with wrong password fails
        mockMvc.perform(post("/api/swappers/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alice_int\",\"password\":\"wrongPassword\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void duplicateUserIdReturns409() throws Exception {
        createSwapper("int_dupe", "dupe_user", "pass");

        String json = """
                {
                    "userId": "int_dupe",
                    "firstName": "Dup",
                    "lastName": "User",
                    "username": "other_name",
                    "password": "pass"
                }
                """;
        mockMvc.perform(post("/api/swappers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isConflict());
    }

    @Test
    void createItemWithOwner_thenFetchByOwner() throws Exception {
        createSwapper("int_owner", "owner_int", "pass");

        createItem("int_owner", "Lego Set", "toy");
        createItem("int_owner", "Robot Kit", "toy");

        mockMvc.perform(get("/api/items/owner/int_owner"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].name", containsInAnyOrder("Lego Set", "Robot Kit")));
    }

    @Test
    void filterItemsByType() throws Exception {
        createSwapper("int_type", "type_int", "pass");

        createItem("int_type", "Toy One", "toy");
        createItem("int_type", "Book One", "book");
        createItem("int_type", "Toy Two", "toy");

        mockMvc.perform(get("/api/items/type/toy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[*].name", everyItem(not("Book One"))));

        mockMvc.perform(get("/api/items/type/book"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Book One"));
    }

    @Test
    void fullSwapLifecycle() throws Exception {
        // Setup: two users, one item each
        createSwapper("int_swapA", "swapA_int", "pass");
        createSwapper("int_swapB", "swapB_int", "pass");

        long itemA = createItem("int_swapA", "Toy A", "toy");
        long itemB = createItem("int_swapB", "Toy B", "toy");

        // Both items visible in global list
        mockMvc.perform(get("/api/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", hasItems("Toy A", "Toy B")));

        // Execute swap
        String swapJson = """
                {"offerItemId": %d, "requestItemId": %d}
                """.formatted(itemA, itemB);

        mockMvc.perform(post("/api/swaps")
                .contentType(MediaType.APPLICATION_JSON)
                .content(swapJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offerItem.currentOwner").value("int_swapB"))
                .andExpect(jsonPath("$.requestItem.currentOwner").value("int_swapA"));

        // After swap: items are still active, with swapped owners
        mockMvc.perform(get("/api/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", hasItems("Toy A", "Toy B")));

        // Toy A now belongs to swapB, Toy B now belongs to swapA
        mockMvc.perform(get("/api/items/" + itemA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentOwner").value("int_swapB"))
                .andExpect(jsonPath("$.active").value(true));

        mockMvc.perform(get("/api/items/" + itemB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentOwner").value("int_swapA"))
                .andExpect(jsonPath("$.active").value(true));

        // Items appear under their new owners
        mockMvc.perform(get("/api/items/owner/int_swapA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", hasItem("Toy B")));

        mockMvc.perform(get("/api/items/owner/int_swapB"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", hasItem("Toy A")));
    }
}
