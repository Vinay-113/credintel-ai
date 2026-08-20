package com.credintel.explanation;

import com.credintel.decision.DecisionDtos.PolicyCheck;
import com.credintel.decision.DecisionDtos.ReasonCode;
import com.credintel.decision.DecisionDtos.Recommendation;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnProperty(name = "app.ai.provider", havingValue = "bedrock")
public class BedrockNarrativeProvider implements NarrativeProvider {
    private final BedrockRuntimeClient client;
    private final ObjectMapper objectMapper;
    private final String modelId;
    private final String systemPrompt;

    public BedrockNarrativeProvider(BedrockRuntimeClient client, ObjectMapper objectMapper,
                                    @Value("${app.ai.bedrock.model-id}") String modelId) throws IOException {
        if (modelId == null || modelId.isBlank()) {
            throw new IllegalStateException("BEDROCK_MODEL_ID is required when AI_PROVIDER=bedrock");
        }
        this.client = client;
        this.objectMapper = objectMapper;
        this.modelId = modelId;
        this.systemPrompt = new ClassPathResource("model/explanation-system-prompt.txt")
                .getContentAsString(StandardCharsets.UTF_8);
    }

    @Override
    public String summarize(Recommendation recommendation, List<ReasonCode> reasons, List<PolicyCheck> checks) {
        try {
            String evidence = objectMapper.writeValueAsString(Map.of(
                    "recommendation", recommendation,
                    "reasonCodes", reasons,
                    "policyChecks", checks,
                    "decisionOwner", "human underwriter"
            ));
            Map<String, Object> payload = Map.of(
                    "anthropic_version", "bedrock-2023-05-31",
                    "max_tokens", 220,
                    "temperature", 0.1,
                    "system", systemPrompt,
                    "messages", List.of(Map.of(
                            "role", "user",
                            "content", List.of(Map.of("type", "text", "text", evidence))
                    ))
            );
            var response = client.invokeModel(InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(objectMapper.writeValueAsString(payload)))
                    .build());
            JsonNode root = objectMapper.readTree(response.body().asUtf8String());
            String text = root.path("content").path(0).path("text").asText("").trim();
            if (text.isBlank() || text.length() > 800) {
                throw new IllegalStateException("Bedrock response failed the narrative guardrail");
            }
            return text;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to create a guardrailed Bedrock narrative", exception);
        }
    }
}
