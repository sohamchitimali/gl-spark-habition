package com.gl.app.AuthService.service;

import com.gl.app.AuthService.entity.User;
import com.gl.app.AuthService.entity.UserProfile;
import com.gl.app.AuthService.repository.UserRepository;
import com.meilisearch.sdk.Client;
import com.meilisearch.sdk.Config;
import com.meilisearch.sdk.Index;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

@Service
public class MeilisearchSyncService {

    @Value("${meilisearch.host:http://localhost:7700}")
    private String meiliHost;

    @Value("${meilisearch.api-key:masterKey}")
    private String meiliApiKey;

    private Client client;
    private Index userIndex;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @PostConstruct
    public void init() {
        try {
            this.client = new Client(new Config(meiliHost, meiliApiKey));
            try {
                this.userIndex = client.getIndex("users");
            } catch (Exception e) {
                // Index doesn't exist, create it
                client.createIndex("users", "id");
                this.userIndex = client.index("users");
                
                // Configure searchable and filterable attributes
                userIndex.updateSearchableAttributesSettings(new String[]{"username", "name", "bio", "tags", "addressDisplay"});
                userIndex.updateFilterableAttributesSettings(new String[]{"tags", "locationVisibility"});
            }
        } catch (Exception e) {
            System.err.println("Warning: Meilisearch could not be initialized during startup. Fallback search will be used. Error: " + e.getMessage());
        }
    }

    public void syncUser(User user) {
        try {
            Map<String, Object> document = new HashMap<>();
            document.put("id", user.getId());
            document.put("username", user.getUsername());
            
            UserProfile profile = user.getProfile();
            if (profile != null) {
                document.put("name", profile.getName());
                document.put("bio", profile.getBio());
                document.put("addressDisplay", profile.getAddressDisplay());
                document.put("locationVisibility", profile.getLocationVisibility() != null ? profile.getLocationVisibility().name() : "PUBLIC");
                
                if (profile.getTags() != null) {
                    List<String> tagNames = profile.getTags().stream()
                        .map(t -> t.getName())
                        .collect(Collectors.toList());
                    document.put("tags", tagNames);
                }
                
                if (profile.getLatitude() != null && profile.getLongitude() != null) {
                    Map<String, Double> geo = new HashMap<>();
                    geo.put("lat", profile.getLatitude());
                    geo.put("lng", profile.getLongitude());
                    document.put("_geo", geo);
                    document.put("latitude", profile.getLatitude());
                    document.put("longitude", profile.getLongitude());
                }
            }

            userIndex.addDocuments(objectMapper.writeValueAsString(List.of(document)));
            System.out.println("Synced user " + user.getId() + " to Meilisearch");
        } catch (Exception e) {
            System.err.println("Failed to sync user to Meilisearch: " + e.getMessage());
        }
    }

    public void deleteUser(Long userId) {
        try {
            userIndex.deleteDocument(String.valueOf(userId));
            System.out.println("Deleted user " + userId + " from Meilisearch");
        } catch (Exception e) {
            System.err.println("Failed to delete user from Meilisearch: " + e.getMessage());
        }
    }

    // Run full sync every hour
    @Scheduled(fixedRate = 3600000)
    public void syncAllUsers() {
        System.out.println("Starting full Meilisearch user sync...");
        List<User> users = userRepository.findAll();
        for (User user : users) {
            syncUser(user);
        }
        System.out.println("Completed full Meilisearch user sync. Total: " + users.size());
    }
}
