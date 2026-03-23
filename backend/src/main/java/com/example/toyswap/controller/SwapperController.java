package com.example.toyswap.controller;

import com.example.toyswap.model.Swapper;
import com.example.toyswap.repository.SwapperRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/swappers")
public class SwapperController {

    private final SwapperRepository swapperRepository;

    public SwapperController(SwapperRepository swapperRepository) {
        this.swapperRepository = swapperRepository;
    }

    @GetMapping
    public List<Swapper> getAllSwappers() {
        return swapperRepository.findAll();
    }

    @GetMapping("/{userId}")
    public ResponseEntity<Swapper> getSwapperById(@PathVariable String userId) {
        return swapperRepository.findById(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Swapper> createSwapper(@RequestBody Swapper swapper) {
        if (swapperRepository.existsById(swapper.getUserId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(swapperRepository.save(swapper));
    }

    // POST /api/login — accepts { username, password }, returns Swapper on success
    @PostMapping("/login")
    public ResponseEntity<Swapper> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");
        if (username == null || password == null) {
            return ResponseEntity.badRequest().build();
        }
        return swapperRepository.findByUsernameAndPassword(username, password)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PutMapping("/{userId}")
    public ResponseEntity<Swapper> updateSwapper(@PathVariable String userId, @RequestBody Swapper updated) {
        if (!swapperRepository.existsById(userId)) {
            return ResponseEntity.notFound().build();
        }
        updated.setUserId(userId);
        return ResponseEntity.ok(swapperRepository.save(updated));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteSwapper(@PathVariable String userId) {
        if (!swapperRepository.existsById(userId)) {
            return ResponseEntity.notFound().build();
        }
        swapperRepository.deleteById(userId);
        return ResponseEntity.noContent().build();
    }
}
