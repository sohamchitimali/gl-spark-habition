package com.gl.app.GroupService.service;

import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.repository.GroupRepository;
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
    private Index groupIndex;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @PostConstruct
    public void init() {
        try {
            this.client = new Client(new Config(meiliHost, meiliApiKey));
            try {
                this.groupIndex = client.getIndex("groups");
            } catch (Exception e) {
                // Index doesn't exist, create it
                client.createIndex("groups", "id");
                this.groupIndex = client.getIndex("groups");
                
                // Configure searchable and filterable attributes
                groupIndex.updateSearchableAttributesSettings(new String[]{"name", "description", "tags"});
                groupIndex.updateFilterableAttributesSettings(new String[]{"visibility", "tags"});
            }
        } catch (Exception e) {
            System.err.println("Warning: Meilisearch could not be initialized during startup. Fallback search will be used. Error: " + e.getMessage());
        }
    }

    public void syncGroup(Group group) {
        try {
            Map<String, Object> document = new HashMap<>();
            document.put("id", group.getId());
            document.put("name", group.getName());
            document.put("description", group.getDescription());
            document.put("visibility", group.getVisibility().name());
            document.put("latitude", group.getLatitude());
            document.put("longitude", group.getLongitude());
            document.put("memberCount", group.getMemberCount());
            
            if (group.getTags() != null) {
                List<String> tagNames = group.getTags().stream().map(t -> t.getName()).collect(Collectors.toList());
                document.put("tags", tagNames);
            }
            
            String json = objectMapper.writeValueAsString(new Map[]{document});
            groupIndex.addDocuments(json);
        } catch (Exception e) {
            System.err.println("Failed to sync group to Meilisearch: " + e.getMessage());
        }
    }

    public void deleteGroup(Long groupId) {
        try {
            groupIndex.deleteDocument(String.valueOf(groupId));
        } catch (Exception e) {
            System.err.println("Failed to delete group from Meilisearch: " + e.getMessage());
        }
    }

    // Hourly Cron Job to ensure resilience
    @Scheduled(cron = "0 0 * * * *")
    public void fullSync() {
        System.out.println("Starting full Meilisearch sync...");
        List<Group> allGroups = groupRepository.findAll();
        
        List<Map<String, Object>> documents = allGroups.stream().map(group -> {
            Map<String, Object> doc = new HashMap<>();
            doc.put("id", group.getId());
            doc.put("name", group.getName());
            doc.put("description", group.getDescription());
            doc.put("visibility", group.getVisibility().name());
            doc.put("latitude", group.getLatitude());
            doc.put("longitude", group.getLongitude());
            doc.put("memberCount", group.getMemberCount());
            
            if (group.getTags() != null) {
                List<String> tagNames = group.getTags().stream().map(t -> t.getName()).collect(Collectors.toList());
                doc.put("tags", tagNames);
            }
            return doc;
        }).collect(Collectors.toList());

        try {
            String json = objectMapper.writeValueAsString(documents);
            groupIndex.addDocuments(json);
            System.out.println("Full Meilisearch sync completed successfully.");
        } catch (Exception e) {
            System.err.println("Failed full Meilisearch sync: " + e.getMessage());
        }
    }
}
