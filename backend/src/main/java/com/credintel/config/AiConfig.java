package com.credintel.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

@Configuration
public class AiConfig {
    @Bean
    @ConditionalOnProperty(name = "app.ai.provider", havingValue = "bedrock")
    BedrockRuntimeClient bedrockRuntimeClient(@Value("${app.ai.bedrock.region}") String region) {
        return BedrockRuntimeClient.builder().region(Region.of(region)).build();
    }
}
