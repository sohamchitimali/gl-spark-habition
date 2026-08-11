package com.gl.app.AuthService;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import com.gl.app.AuthService.service.MeilisearchSyncService;
import com.gl.app.AuthService.service.UserSearchService;

@SpringBootTest
class AuthServiceApplicationTests {

    @MockBean
    private MeilisearchSyncService meilisearchSyncService;

    @MockBean
    private UserSearchService userSearchService;

	@Test
	void contextLoads() {
	}

}
