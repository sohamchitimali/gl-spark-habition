package com.gl.app.HabitService;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableDiscoveryClient
@EnableFeignClients
public class HabitServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(HabitServiceApplication.class, args);
	}

}
