package com.example.toyswap.repository;

import com.example.toyswap.model.Swapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class SwapperRepositoryTest {

    @Autowired
    private SwapperRepository swapperRepository;

    private Swapper buildSwapper(String userId, String username) {
        Swapper s = new Swapper();
        s.setUserId(userId);
        s.setFirstName("Alice");
        s.setLastName("Smith");
        s.setUsername(username);
        s.setPassword("secret");
        s.setZipCode("12345");
        s.setBirthday(LocalDate.of(1990, 6, 15));
        return s;
    }

    @Test
    void save_andFindById_returnsSwapper() {
        swapperRepository.save(buildSwapper("u1", "asmith"));

        Optional<Swapper> found = swapperRepository.findById("u1");

        assertThat(found).isPresent();
        assertThat(found.get().getFirstName()).isEqualTo("Alice");
        assertThat(found.get().getUsername()).isEqualTo("asmith");
        assertThat(found.get().getBirthday()).isEqualTo(LocalDate.of(1990, 6, 15));
    }

    @Test
    void existsById_returnsTrueAfterSave() {
        swapperRepository.save(buildSwapper("u1", "asmith"));

        assertThat(swapperRepository.existsById("u1")).isTrue();
    }

    @Test
    void existsById_returnsFalseForMissingId() {
        assertThat(swapperRepository.existsById("ghost")).isFalse();
    }

    @Test
    void findAll_returnsAllSavedSwappers() {
        swapperRepository.save(buildSwapper("u1", "alice"));
        swapperRepository.save(buildSwapper("u2", "bob"));

        List<Swapper> all = swapperRepository.findAll();

        assertThat(all).hasSize(2);
        assertThat(all).extracting(Swapper::getUserId).containsExactlyInAnyOrder("u1", "u2");
    }

    @Test
    void deleteById_removesSwapper() {
        swapperRepository.save(buildSwapper("u1", "asmith"));
        swapperRepository.deleteById("u1");

        assertThat(swapperRepository.findById("u1")).isEmpty();
    }

    @Test
    void findById_returnsEmpty_forNonExistentId() {
        assertThat(swapperRepository.findById("unknown")).isEmpty();
    }
}
