package com.gl.app.GroupService.service;

import com.gl.app.GroupService.entity.Group;
import com.gl.app.GroupService.repository.GroupRepository;
import com.meilisearch.sdk.Client;
import com.meilisearch.sdk.Index;
import com.meilisearch.sdk.SearchRequest;
import com.meilisearch.sdk.model.Searchable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class GroupSearchService {

    @Value("${meilisearch.host:http://localhost:7700}")
    private String meiliHost;

    @Value("${meilisearch.api-key:masterKey}")
    private String meiliApiKey;

    private Client client;
    private Index groupIndex;

    @Autowired
    private GroupRepository groupRepository;

    @PostConstruct
    public void init() throws Exception {
        this.client = new Client(new com.meilisearch.sdk.Config(meiliHost, meiliApiKey));
        this.groupIndex = client.getIndex("groups");
    }

    public List<Group> searchGroups(String query, List<String> userTags, Double userLat, Double userLng) {
        try {
            // 1. Initial Meilisearch query to get keyword matches
            SearchRequest request = SearchRequest.builder()
                    .q(query)
                    .filter(new String[]{"visibility = 'PUBLIC' OR visibility = 'OPEN'"})
                    .limit(100)
                    .build();
                    
            Searchable searchResult = groupIndex.search(request);
            List<Long> matchedIds = searchResult.getHits().stream()
                    .map(hit -> Double.valueOf(((java.util.Map) hit).get("id").toString()).longValue())
                    .collect(Collectors.toList());

            if (matchedIds.isEmpty()) return Collections.emptyList();

            // 2. Fetch full entities from Postgres
            List<Group> groups = groupRepository.findAllById(matchedIds);

            // 3. Jaccard Similarity + Geo + Popularity Re-Ranking
            groups.sort((g1, g2) -> {
                double score1 = calculateScore(g1, userTags, userLat, userLng);
                double score2 = calculateScore(g2, userTags, userLat, userLng);
                return Double.compare(score2, score1); // Descending
            });

            return groups;

        } catch (Exception e) {
            System.err.println("Search failed: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    private double calculateScore(Group group, List<String> userTags, Double userLat, Double userLng) {
        double jaccardScore = calculateJaccardSimilarity(group, userTags);
        
        // Base score uses Jaccard Similarity heavily
        double finalScore = jaccardScore * 50.0;
        
        // Add member count popularity boost
        finalScore += Math.min(group.getMemberCount() * 0.5, 20.0);
        
        // Add exponential decay geo proximity boost if available
        if (userLat != null && userLng != null && group.getLatitude() != null && group.getLongitude() != null) {
            double distance = calculateDistance(userLat, userLng, group.getLatitude(), group.getLongitude());
            
            // Maximum boost for 0 distance is 40.0
            // Decay constant: distance / 30.0 (decreases by ~63% every 30km)
            double geoBoost = 40.0 * Math.exp(-distance / 30.0);
            
            finalScore += geoBoost;
        }

        return finalScore;
    }

    private double calculateJaccardSimilarity(Group group, List<String> userTags) {
        if (userTags == null || userTags.isEmpty() || group.getTags() == null || group.getTags().isEmpty()) {
            return 0.0;
        }
        
        Set<String> uTags = new HashSet<>(userTags);
        Set<String> gTags = group.getTags().stream().map(t -> t.getName()).collect(Collectors.toSet());
        
        Set<String> intersection = new HashSet<>(uTags);
        intersection.retainAll(gTags);
        
        Set<String> union = new HashSet<>(uTags);
        union.addAll(gTags);
        
        return (double) intersection.size() / union.size();
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        // Haversine formula
        final int R = 6371; // Radius of the earth
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; 
    }
}
