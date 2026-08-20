package com.credintel.api;

import com.credintel.decision.DecisionDtos.AssessmentRequest;
import com.credintel.decision.DecisionDtos.DecisionResponse;
import com.credintel.decision.DecisionDtos.ModelMetrics;
import com.credintel.decision.UnderwritingService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class DecisionController {
    private final UnderwritingService service;

    public DecisionController(UnderwritingService service) {
        this.service = service;
    }

    @PostMapping("/decisions")
    @ResponseStatus(HttpStatus.CREATED)
    public DecisionResponse assess(@Valid @RequestBody AssessmentRequest request) {
        return service.assess(request);
    }

    @GetMapping("/decisions")
    public Map<String, List<DecisionResponse>> recent() {
        return Map.of("decisions", service.recent());
    }

    @GetMapping("/decisions/{id}")
    public DecisionResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @GetMapping("/model")
    public ModelMetrics model() {
        return service.modelMetrics();
    }
}
