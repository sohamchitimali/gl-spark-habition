package com.gl.app.HabitService.client;

import com.gl.app.HabitService.dto.CreditCoinsRequest;
import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class GroupCoinClientFallback implements GroupCoinClient {
    @Override
    public void creditCoins(CreditCoinsRequest request) {
        log.warn("GroupService is down! Failed to credit {} coins for userId {} in groupId {}. Silent fallback.", 
            request.getAmount(), request.getUserId(), request.getGroupId());
    }
}
