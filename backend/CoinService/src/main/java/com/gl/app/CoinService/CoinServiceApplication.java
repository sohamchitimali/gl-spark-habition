package com.gl.app.CoinService;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class CoinServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(CoinServiceApplication.class, args);
	}

}
