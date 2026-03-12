package com.example.toyswap.repository;

import com.example.toyswap.model.Item;
import com.example.toyswap.model.Swapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ItemRepositoryTest {

    @Autowired
    private ItemRepository itemRepository;

    @Autowired
    private SwapperRepository swapperRepository;

    private Swapper owner;

    @BeforeEach
    void setUp() {
        Swapper s = new Swapper();
        s.setUserId("u1");
        s.setFirstName("Alice");
        s.setLastName("Smith");
        s.setUsername("asmith");
        s.setPassword("secret");
        owner = swapperRepository.save(s);
    }

    private Item buildItem(String name, String type, String ageLevel, Swapper currentOwner) {
        Item item = new Item();
        item.setName(name);
        item.setType(type);
        item.setCondition("new");
        item.setAgeLevel(ageLevel);
        item.setEstimatedValue(10.0f);
        item.setCurrentOwner(currentOwner);
        return item;
    }

    @Test
    void findByCurrentOwnerAndActiveTrue_returnsItemsForThatOwner() {
        itemRepository.save(buildItem("Lego", "toy", "child", owner));
        itemRepository.save(buildItem("Puzzle", "toy", "child", owner));

        List<Item> items = itemRepository.findByCurrentOwnerAndActiveTrue(owner);

        assertThat(items).hasSize(2);
        assertThat(items).extracting(Item::getName).containsExactlyInAnyOrder("Lego", "Puzzle");
    }

    @Test
    void findByCurrentOwnerAndActiveTrue_returnsEmptyListWhenNoItems() {
        List<Item> items = itemRepository.findByCurrentOwnerAndActiveTrue(owner);

        assertThat(items).isEmpty();
    }

    @Test
    void findByCurrentOwnerAndActiveTrue_excludesInactiveItems() {
        Item active = buildItem("Lego", "toy", "child", owner);
        Item inactive = buildItem("Old Toy", "toy", "child", owner);
        inactive.setActive(false);
        itemRepository.save(active);
        itemRepository.save(inactive);

        List<Item> items = itemRepository.findByCurrentOwnerAndActiveTrue(owner);

        assertThat(items).hasSize(1);
        assertThat(items.get(0).getName()).isEqualTo("Lego");
    }

    @Test
    void findByTypeAndActiveTrue_returnsOnlyMatchingType() {
        itemRepository.save(buildItem("Lego", "toy", "child", null));
        itemRepository.save(buildItem("Moby Dick", "book", "kid", null));
        itemRepository.save(buildItem("Puzzle", "toy", "toddler", null));

        List<Item> toys = itemRepository.findByTypeAndActiveTrue("toy");

        assertThat(toys).hasSize(2);
        assertThat(toys).extracting(Item::getType).containsOnly("toy");
    }

    @Test
    void findByTypeAndActiveTrue_returnsEmptyListForUnknownType() {
        List<Item> items = itemRepository.findByTypeAndActiveTrue("unknown");

        assertThat(items).isEmpty();
    }

    @Test
    void findByTypeAndActiveTrue_excludesInactiveItems() {
        Item active = buildItem("Lego", "toy", "child", null);
        Item inactive = buildItem("Old Toy", "toy", "child", null);
        inactive.setActive(false);
        itemRepository.save(active);
        itemRepository.save(inactive);

        List<Item> toys = itemRepository.findByTypeAndActiveTrue("toy");

        assertThat(toys).hasSize(1);
        assertThat(toys.get(0).getName()).isEqualTo("Lego");
    }

    @Test
    void findByAgeLevelAndActiveTrue_returnsOnlyMatchingLevel() {
        itemRepository.save(buildItem("Rattle", "toy", "baby", null));
        itemRepository.save(buildItem("Blocks", "toy", "toddler", null));
        itemRepository.save(buildItem("Teddy", "toy", "baby", null));

        List<Item> babyItems = itemRepository.findByAgeLevelAndActiveTrue("baby");

        assertThat(babyItems).hasSize(2);
        assertThat(babyItems).extracting(Item::getAgeLevel).containsOnly("baby");
    }

    @Test
    void findByAgeLevelAndActiveTrue_returnsEmptyListForUnknownLevel() {
        List<Item> items = itemRepository.findByAgeLevelAndActiveTrue("adult");

        assertThat(items).isEmpty();
    }

    @Test
    void findByAgeLevelAndActiveTrue_excludesInactiveItems() {
        Item active = buildItem("Rattle", "toy", "baby", null);
        Item inactive = buildItem("Old Rattle", "toy", "baby", null);
        inactive.setActive(false);
        itemRepository.save(active);
        itemRepository.save(inactive);

        List<Item> babyItems = itemRepository.findByAgeLevelAndActiveTrue("baby");

        assertThat(babyItems).hasSize(1);
        assertThat(babyItems.get(0).getName()).isEqualTo("Rattle");
    }

    @Test
    void findByActiveTrue_returnsOnlyActiveItems() {
        Item active = buildItem("Lego", "toy", "child", null);
        Item inactive = buildItem("Puzzle", "toy", "child", null);
        inactive.setActive(false);
        itemRepository.save(active);
        itemRepository.save(inactive);

        List<Item> activeItems = itemRepository.findByActiveTrue();

        assertThat(activeItems).hasSize(1);
        assertThat(activeItems.get(0).getName()).isEqualTo("Lego");
    }

    @Test
    void save_andFindById_returnsItem() {
        Item saved = itemRepository.save(buildItem("Lego", "toy", "child", owner));

        assertThat(itemRepository.findById(saved.getId())).isPresent();
        assertThat(itemRepository.findById(saved.getId()).get().getName()).isEqualTo("Lego");
    }

    @Test
    void deleteById_removesItem() {
        Item saved = itemRepository.save(buildItem("Lego", "toy", "child", null));
        itemRepository.deleteById(saved.getId());

        assertThat(itemRepository.findById(saved.getId())).isEmpty();
    }
}
