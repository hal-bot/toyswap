package com.example.toyswap.repository;

import com.example.toyswap.model.Item;
import com.example.toyswap.model.Swapper;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemRepository extends JpaRepository<Item, Long> {

    List<Item> findByCurrentOwner(Swapper owner);

    List<Item> findByType(String type);

    List<Item> findByAgeLevel(String ageLevel);
}
