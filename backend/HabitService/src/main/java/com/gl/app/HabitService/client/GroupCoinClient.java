package com.gl.app.HabitService.client;

import com.gl.app.HabitService.dto.CreditCoinsRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "GROUP-SERVICE", contextId = "groupCoinClient")
public interface GroupCoinClient {

    @PostMapping("/coins/credit")
    void creditCoins(@RequestBody CreditCoinsRequest request);
}
