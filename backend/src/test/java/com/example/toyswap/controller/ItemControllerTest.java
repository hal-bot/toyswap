package com.example.toyswap.controller;

import com.example.toyswap.model.Item;
import com.example.toyswap.model.Swapper;
import com.example.toyswap.repository.ItemRepository;
import com.example.toyswap.repository.SwapperRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
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
class ItemControllerTest {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;

    @MockitoBean
    private ItemRepository itemRepository;

    @MockitoBean
    private SwapperRepository swapperRepository;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    private static final String ITEM_JSON = """
            {
                "name": "Lego",
                "type": "toy",
                "condition": "new",
                "ageLevel": "child",
                "estimatedValue": 10.0,
                "requireBatteries": false
            }
            """;

    private Item buildItem(Long id, String name, String type, String ageLevel) {
        Item item = new Item();
        item.setId(id);
        item.setName(name);
        item.setType(type);
        item.setCondition("new");
        item.setAgeLevel(ageLevel);
        item.setEstimatedValue(10.0f);
        item.setRequireBatteries(false);
        return item;
    }

    private Swapper buildSwapper(String userId) {
        Swapper s = new Swapper();
        s.setUserId(userId);
        s.setFirstName("Alice");
        s.setLastName("Smith");
        s.setUsername("asmith");
        s.setPassword("secret");
        return s;
    }

    @Test
    void getAllItems_returnsList() throws Exception {
        given(itemRepository.findByActiveTrueOrderByIdDesc()).willReturn(
                List.of(buildItem(1L, "Lego", "toy", "child"), buildItem(2L, "Puzzle", "toy", "kid")));

        mockMvc.perform(get("/api/items"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        verify(itemRepository).findByActiveTrueOrderByIdDesc();
    }

    @Test
    void getAllItems_returnsEmptyList() throws Exception {
        given(itemRepository.findByActiveTrueOrderByIdDesc()).willReturn(List.of());

        mockMvc.perform(get("/api/items"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));

        verify(itemRepository).findByActiveTrueOrderByIdDesc();
    }

    @Test
    void getItemById_found_returns200WithBody() throws Exception {
        given(itemRepository.findById(1L)).willReturn(Optional.of(buildItem(1L, "Lego", "toy", "child")));

        mockMvc.perform(get("/api/items/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Lego"))
                .andExpect(jsonPath("$.type").value("toy"));
    }

    @Test
    void getItemById_notFound_returns404() throws Exception {
        given(itemRepository.findById(99L)).willReturn(Optional.empty());

        mockMvc.perform(get("/api/items/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getItemsByOwner_ownerExists_returns200WithItems() throws Exception {
        Swapper owner = buildSwapper("u1");
        given(swapperRepository.findById("u1")).willReturn(Optional.of(owner));
        given(itemRepository.findByCurrentOwnerAndActiveTrue(any(Swapper.class)))
                .willReturn(List.of(buildItem(1L, "Lego", "toy", "child")));

        mockMvc.perform(get("/api/items/owner/u1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Lego"));

        verify(itemRepository).findByCurrentOwnerAndActiveTrue(any(Swapper.class));
    }

    @Test
    void getItemsByOwner_ownerNotFound_returns404() throws Exception {
        given(swapperRepository.findById("ghost")).willReturn(Optional.empty());

        mockMvc.perform(get("/api/items/owner/ghost"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getItemsByType_returnsMatchingItems() throws Exception {
        given(itemRepository.findByTypeAndActiveTrue("toy"))
                .willReturn(List.of(buildItem(1L, "Lego", "toy", "child")));

        mockMvc.perform(get("/api/items/type/toy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].type").value("toy"));

        verify(itemRepository).findByTypeAndActiveTrue("toy");
    }

    @Test
    void getItemsByAgeLevel_returnsMatchingItems() throws Exception {
        given(itemRepository.findByAgeLevelAndActiveTrue("toddler"))
                .willReturn(List.of(buildItem(1L, "Soft Blocks", "toy", "toddler")));

        mockMvc.perform(get("/api/items/age/toddler"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].ageLevel").value("toddler"));

        verify(itemRepository).findByAgeLevelAndActiveTrue("toddler");
    }

    @Test
    void createItem_withoutOwner_returns201WithActiveTrue() throws Exception {
        Item saved = buildItem(1L, "Lego", "toy", "child");
        saved.setActive(true);
        given(itemRepository.save(any(Item.class))).willReturn(saved);

        mockMvc.perform(post("/api/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content(ITEM_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.active").value(true));
    }

    @Test
    void createItem_withValidOwnerId_setsOwnerAndReturns201() throws Exception {
        Swapper owner = buildSwapper("u1");
        Item saved = buildItem(1L, "Lego", "toy", "child");
        saved.setCurrentOwner(owner);
        given(swapperRepository.existsById("u1")).willReturn(true);
        given(swapperRepository.findById("u1")).willReturn(Optional.of(owner));
        given(itemRepository.save(any(Item.class))).willReturn(saved);

        mockMvc.perform(post("/api/items?ownerId=u1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(ITEM_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));

        verify(swapperRepository).findById("u1");
    }

    @Test
    void createItem_withInvalidOwnerId_returns404() throws Exception {
        given(swapperRepository.existsById("ghost")).willReturn(false);

        mockMvc.perform(post("/api/items?ownerId=ghost")
                .contentType(MediaType.APPLICATION_JSON)
                .content(ITEM_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateItem_found_returns200WithUpdatedBody() throws Exception {
        Item existing = buildItem(1L, "Old Lego", "toy", "child");
        Item updated = buildItem(1L, "New Lego", "toy", "child");
        given(itemRepository.findById(1L)).willReturn(Optional.of(existing));
        given(itemRepository.save(any(Item.class))).willReturn(updated);

        mockMvc.perform(put("/api/items/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(ITEM_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New Lego"));
    }

    @Test
    void updateItem_notFound_returns404() throws Exception {
        given(itemRepository.findById(99L)).willReturn(Optional.empty());

        mockMvc.perform(put("/api/items/99")
                .contentType(MediaType.APPLICATION_JSON)
                .content(ITEM_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateItem_withOwnerId_queriesNewOwner() throws Exception {
        Item existing = buildItem(1L, "Lego", "toy", "child");
        Swapper owner = buildSwapper("u1");
        Item updated = buildItem(1L, "Lego", "toy", "child");
        updated.setCurrentOwner(owner);
        given(itemRepository.findById(1L)).willReturn(Optional.of(existing));
        given(swapperRepository.findById("u1")).willReturn(Optional.of(owner));
        given(itemRepository.save(any(Item.class))).willReturn(updated);

        mockMvc.perform(put("/api/items/1?ownerId=u1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(ITEM_JSON))
                .andExpect(status().isOk());

        verify(swapperRepository).findById("u1");
    }

    @Test
    void updateItem_withoutOwnerId_preservesExistingOwner() throws Exception {
        Swapper owner = buildSwapper("u1");
        Item existing = buildItem(1L, "Lego", "toy", "child");
        existing.setCurrentOwner(owner);
        Item updated = buildItem(1L, "New Lego", "toy", "child");
        updated.setCurrentOwner(owner);
        given(itemRepository.findById(1L)).willReturn(Optional.of(existing));
        given(itemRepository.save(any(Item.class))).willReturn(updated);

        mockMvc.perform(put("/api/items/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(ITEM_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New Lego"));
    }

    @Test
    void deleteItem_exists_returns204() throws Exception {
        given(itemRepository.existsById(1L)).willReturn(true);

        mockMvc.perform(delete("/api/items/1"))
                .andExpect(status().isNoContent());

        verify(itemRepository).deleteById(1L);
    }

    @Test
    void deleteItem_notFound_returns404() throws Exception {
        given(itemRepository.existsById(99L)).willReturn(false);

        mockMvc.perform(delete("/api/items/99"))
                .andExpect(status().isNotFound());
    }
}
