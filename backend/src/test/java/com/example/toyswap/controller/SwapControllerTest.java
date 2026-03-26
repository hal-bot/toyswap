package com.example.toyswap.controller;

import com.example.toyswap.model.Item;
import com.example.toyswap.model.Swapper;
import com.example.toyswap.repository.ItemRepository;
import com.example.toyswap.service.SwapEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class SwapControllerTest {

    @Autowired
    private WebApplicationContext wac;

    private MockMvc mockMvc;

    @MockitoBean
    private ItemRepository itemRepository;

    @MockitoBean
    private SwapEventPublisher eventPublisher;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(wac).build();
    }

    private Item buildActiveItem(Long id, String name, Swapper owner) {
        Item item = new Item();
        item.setId(id);
        item.setName(name);
        item.setType("toy");
        item.setCondition("new");
        item.setAgeLevel("child");
        item.setActive(true);
        item.setCurrentOwner(owner);
        return item;
    }

    private Swapper buildSwapper(String userId) {
        Swapper s = new Swapper();
        s.setUserId(userId);
        s.setFirstName("Alice");
        s.setLastName("Smith");
        s.setUsername("user_" + userId);
        s.setPassword("secret");
        return s;
    }

    @Test
    void completeSwap_bothItemsActive_returns200WithSwappedOwners() throws Exception {
        Swapper ownerA = buildSwapper("u1");
        Swapper ownerB = buildSwapper("u2");
        Item offerItem = buildActiveItem(1L, "Lego", ownerA);
        Item requestItem = buildActiveItem(2L, "Puzzle", ownerB);

        given(itemRepository.findById(1L)).willReturn(Optional.of(offerItem));
        given(itemRepository.findById(2L)).willReturn(Optional.of(requestItem));
        given(itemRepository.save(any(Item.class))).willAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/swaps")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"offerItemId\":1,\"requestItemId\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offerItem.active").value(true))
                .andExpect(jsonPath("$.requestItem.active").value(true))
                .andExpect(jsonPath("$.offerItem.currentOwner").value("u2"))
                .andExpect(jsonPath("$.requestItem.currentOwner").value("u1"));
    }

    @Test
    void completeSwap_oneItemInactive_returns409() throws Exception {
        Swapper ownerA = buildSwapper("u1");
        Swapper ownerB = buildSwapper("u2");
        Item offerItem = buildActiveItem(1L, "Lego", ownerA);
        Item requestItem = buildActiveItem(2L, "Puzzle", ownerB);
        requestItem.setActive(false);

        given(itemRepository.findById(1L)).willReturn(Optional.of(offerItem));
        given(itemRepository.findById(2L)).willReturn(Optional.of(requestItem));

        mockMvc.perform(post("/api/swaps")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"offerItemId\":1,\"requestItemId\":2}"))
                .andExpect(status().isConflict());
    }

    @Test
    void completeSwap_nonExistentItem_returns404() throws Exception {
        given(itemRepository.findById(1L)).willReturn(Optional.empty());
        given(itemRepository.findById(999L)).willReturn(Optional.empty());

        mockMvc.perform(post("/api/swaps")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"offerItemId\":1,\"requestItemId\":999}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void completeSwap_missingBodyFields_returns400() throws Exception {
        mockMvc.perform(post("/api/swaps")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"offerItemId\":1}"))
                .andExpect(status().isBadRequest());
    }
}
