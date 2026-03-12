package com.example.toyswap.controller;

import com.example.toyswap.model.Item;
import com.example.toyswap.repository.ItemRepository;
import com.example.toyswap.repository.SwapperRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/items")
public class ItemController {

    private final ItemRepository itemRepository;
    private final SwapperRepository swapperRepository;

    public ItemController(ItemRepository itemRepository, SwapperRepository swapperRepository) {
        this.itemRepository = itemRepository;
        this.swapperRepository = swapperRepository;
    }

    @GetMapping
    public List<Item> getAllItems() {
        return itemRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Item> getItemById(@PathVariable Long id) {
        return itemRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/items/owner/{userId} — all items belonging to a swapper
    @GetMapping("/owner/{userId}")
    public ResponseEntity<List<Item>> getItemsByOwner(@PathVariable String userId) {
        return swapperRepository.findById(userId)
                .map(owner -> ResponseEntity.ok(itemRepository.findByCurrentOwner(owner)))
                .orElse(ResponseEntity.notFound().build());
    }

    // GET /api/items/type/{type} — filter by toy, book, misc
    @GetMapping("/type/{type}")
    public List<Item> getItemsByType(@PathVariable String type) {
        return itemRepository.findByType(type);
    }

    // GET /api/items/age/{ageLevel} — filter by baby, crawler, toddler, child, kid
    @GetMapping("/age/{ageLevel}")
    public List<Item> getItemsByAgeLevel(@PathVariable String ageLevel) {
        return itemRepository.findByAgeLevel(ageLevel);
    }

    // POST /api/items?ownerId={userId}
    @PostMapping
    public ResponseEntity<Item> createItem(@RequestBody Item item,
            @RequestParam(required = false) String ownerId) {
        if (ownerId != null) {
            swapperRepository.findById(ownerId).ifPresent(item::setCurrentOwner);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(itemRepository.save(item));
    }

    // PUT /api/items/{id}?ownerId={userId}
    @PutMapping("/{id}")
    public ResponseEntity<Item> updateItem(@PathVariable Long id,
            @RequestBody Item updated,
            @RequestParam(required = false) String ownerId) {
        return itemRepository.findById(id).map(existing -> {
            updated.setId(id);
            if (ownerId != null) {
                swapperRepository.findById(ownerId).ifPresent(updated::setCurrentOwner);
            } else {
                updated.setCurrentOwner(existing.getCurrentOwner());
            }
            return ResponseEntity.ok(itemRepository.save(updated));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        if (!itemRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        itemRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
