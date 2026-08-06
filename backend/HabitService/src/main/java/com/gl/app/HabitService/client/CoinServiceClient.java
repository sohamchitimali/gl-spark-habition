package com.gl.app.HabitService.client;

import com.gl.app.HabitService.dto.CreditCoinsRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * REST client for communicating with the Coin Service via Eureka-resolved hostname.
 * Uses a load-balanced {@link RestTemplate} to resolve {@code COIN-SERVICE}.
 */
@Component
@Slf4j
public class CoinServiceClient {

    @Autowired
    private RestTemplate restTemplate;

    private static final String COIN_SERVICE_URL = "http://COIN-SERVICE/coins/credit";

    /**
     * Credits coins to a user by calling the Coin Service.
     *
     * @param request the credit request containing user ID, amount, and reason
     */
    public void creditCoins(CreditCoinsRequest request) {
        try {
            restTemplate.postForObject(COIN_SERVICE_URL, request, String.class);
            log.info("Credited {} coins to userId={}", request.getAmount(), request.getUserId());
        } catch (Exception e) {
            log.error("Failed to credit coins for userId={}: {}", request.getUserId(), e.getMessage());
        }
    }
}
