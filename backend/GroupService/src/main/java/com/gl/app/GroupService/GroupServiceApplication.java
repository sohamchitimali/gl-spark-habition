package com.gl.app.GroupService;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableDiscoveryClient
@EnableScheduling
public class GroupServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(GroupServiceApplication.class, args);
	}

	@org.springframework.context.annotation.Bean
	public org.springframework.boot.CommandLineRunner alterTable(org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
		return args -> {
			try {
				jdbcTemplate.execute("ALTER TABLE direct_messages ALTER COLUMN receiver_id DROP NOT NULL;");
				System.out.println("SUCCESSFULLY ALTERED TABLE direct_messages");
			} catch (Exception e) {
				System.out.println("COULD NOT ALTER TABLE (maybe already altered): " + e.getMessage());
			}
		};
	}

}
