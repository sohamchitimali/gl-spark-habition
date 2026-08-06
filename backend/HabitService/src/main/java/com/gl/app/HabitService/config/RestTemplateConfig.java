package com.gl.app.HabitService.config;

import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Spring configuration for inter-service REST communication.
 */
@Configuration
public class RestTemplateConfig {

    /**
     * Creates a load-balanced {@link RestTemplate} that resolves service names via Eureka.
     *
     * @return a load-balanced RestTemplate instance
     */
    @Bean
    @LoadBalanced
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
