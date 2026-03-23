package com.example.toyswap.repository;

import com.example.toyswap.model.Item;
import com.example.toyswap.model.Swapper;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ItemRepository extends JpaRepository<Item, Long> {

    List<Item> findByActiveTrue();

    List<Item> findByActiveTrueOrderByIdDesc();

    List<Item> findByCurrentOwnerAndActiveTrue(Swapper owner);

    List<Item> findByTypeAndActiveTrue(String type);

    List<Item> findByAgeLevelAndActiveTrue(String ageLevel);
}
