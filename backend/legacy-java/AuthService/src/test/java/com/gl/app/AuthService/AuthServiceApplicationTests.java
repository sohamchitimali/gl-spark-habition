package com.gl.app.AuthService;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.gl.app.AuthService.service.MeilisearchSyncService;
import com.gl.app.AuthService.service.UserSearchService;

@SpringBootTest
class AuthServiceApplicationTests {

    @MockitoBean
    private MeilisearchSyncService meilisearchSyncService;

    @MockitoBean
    private UserSearchService userSearchService;

	@Test
	void contextLoads() {
	}

}
