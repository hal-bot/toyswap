package com.example.toyswap.controller;

import com.example.toyswap.model.Item;
import com.example.toyswap.model.Swapper;
import com.example.toyswap.repository.ItemRepository;
import com.example.toyswap.service.SwapEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/swaps")
public class SwapController {

    private final ItemRepository itemRepository;
    private final SwapEventPublisher eventPublisher;

    public SwapController(ItemRepository itemRepository, SwapEventPublisher eventPublisher) {
        this.itemRepository = itemRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * POST /api/swaps
     * Body: { "offerItemId": 1, "requestItemId": 2 }
     *
     * Validates both items are active, swaps ownership between the two owners.
     * Returns the two updated items.
     */
    @PostMapping
    public ResponseEntity<?> completeSwap(@RequestBody Map<String, Long> body) {
        Long offerItemId = body.get("offerItemId");
        Long requestItemId = body.get("requestItemId");

        if (offerItemId == null || requestItemId == null) {
            return ResponseEntity.badRequest().body("Both offerItemId and requestItemId are required.");
        }

        Optional<Item> offerOpt = itemRepository.findById(offerItemId);
        Optional<Item> requestOpt = itemRepository.findById(requestItemId);

        if (offerOpt.isEmpty() || requestOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Item offerItem = offerOpt.get();
        Item requestItem = requestOpt.get();

        if (!offerItem.isActive() || !requestItem.isActive()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("One or both items are no longer available.");
        }

        // Swap ownership
        Swapper offerOwner = offerItem.getCurrentOwner();
        Swapper requestOwner = requestItem.getCurrentOwner();

        offerItem.setCurrentOwner(requestOwner);
        requestItem.setCurrentOwner(offerOwner);

        itemRepository.save(offerItem);
        itemRepository.save(requestItem);

        // Publish swap-completed event to SNS (→ SQS → Lambda notification processor)
        eventPublisher.publishSwapCompleted(offerItem, requestItem);

        return ResponseEntity.ok(Map.of("offerItem", offerItem, "requestItem", requestItem));
    }
}
