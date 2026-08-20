package com.credintel.decision;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DecisionRepository extends JpaRepository<DecisionEntity, String> {
    List<DecisionEntity> findTop20ByOrderByCreatedAtDesc();
}
