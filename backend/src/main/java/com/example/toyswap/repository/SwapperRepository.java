package com.example.toyswap.repository;

import com.example.toyswap.model.Swapper;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SwapperRepository extends JpaRepository<Swapper, String> {
}
