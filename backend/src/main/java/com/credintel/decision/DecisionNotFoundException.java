package com.credintel.decision;

public class DecisionNotFoundException extends RuntimeException {
    public DecisionNotFoundException(String id) {
        super("Decision not found: " + id);
    }
}
