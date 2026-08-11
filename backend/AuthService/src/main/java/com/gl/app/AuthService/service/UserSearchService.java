package com.gl.app.AuthService.service;

import com.gl.app.AuthService.dto.ProfileDto;
import com.gl.app.AuthService.entity.User;
import com.gl.app.AuthService.repository.UserRepository;
import com.meilisearch.sdk.Client;
import com.meilisearch.sdk.Config;
import com.meilisearch.sdk.Index;
import com.meilisearch.sdk.SearchRequest;
import com.meilisearch.sdk.model.SearchResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import jakarta.annotation.PostConstruct;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserSearchService {

    @Value("${meilisearch.host:http://localhost:7700}")
    private String meiliHost;

    @Value("${meilisearch.api-key:masterKey}")
    private String meiliApiKey;

    private Client client;
    private Index userIndex;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    @PostConstruct
    public void init() {
        try {
            this.client = new Client(new Config(meiliHost, meiliApiKey));
            this.userIndex = client.index("users");
        } catch (Exception e) {
            System.err.println("Warning: Meilisearch index not available during startup in UserSearchService.");
        }
    }

    @CircuitBreaker(name = "meilisearch", fallbackMethod = "fallbackSearchUsers")
    public List<ProfileDto> searchUsers(String query, List<String> userTags, Double userLat, Double userLng) {
        try {
            // 1. Search Meilisearch (Basic Text + Tag Matching)
            SearchRequest request = SearchRequest.builder()
                    .q(query)
                    .limit(100)
                    .build();

            com.meilisearch.sdk.model.Searchable searchResult = userIndex.search(request);
            List<HashMap<String, Object>> hits = searchResult.getHits();

            if (hits.isEmpty()) {
                return Collections.emptyList();
            }

            // Extract User IDs
            List<Long> userIds = hits.stream()
                    .map(hit -> Double.valueOf(((java.util.Map) hit).get("id").toString()).longValue())
                    .collect(Collectors.toList());

            // 2. Fetch Users from DB
            List<User> users = userRepository.findAllById(userIds);

            // Fetch ProfileDtos for all users
            List<ProfileDto> profiles = users.stream()
                    .map(u -> userService.getProfile(u.getId()))
                    .collect(Collectors.toList());

            // 3. Re-rank based on Jaccard + Exponential Decay Haversine Geo Boost
            profiles.sort((p1, p2) -> {
                double score1 = calculateScore(p1, userTags, userLat, userLng);
                double score2 = calculateScore(p2, userTags, userLat, userLng);
                return Double.compare(score2, score1); // Descending
            });

            return profiles;

        } catch (Exception e) {
            throw new RuntimeException("Meilisearch failed, triggering fallback", e);
        }
    }

    public List<ProfileDto> fallbackSearchUsers(String query, List<String> userTags, Double userLat, Double userLng, Throwable t) {
        System.err.println("Circuit Breaker triggered. Using fallback SQL search for users. Reason: " + t.getMessage());
        
        // 1. Fetch from Postgres using LIKE
        List<User> users = userRepository.findByUsernameContainingIgnoreCaseOrProfile_NameContainingIgnoreCase(query, query);

        if (users.isEmpty()) return Collections.emptyList();

        // Fetch ProfileDtos for all users
        List<ProfileDto> profiles = users.stream()
                .map(u -> userService.getProfile(u.getId()))
                .collect(Collectors.toList());

        // 2. Exact same Jaccard Similarity + Geo Re-Ranking
        profiles.sort((p1, p2) -> {
            double score1 = calculateScore(p1, userTags, userLat, userLng);
            double score2 = calculateScore(p2, userTags, userLat, userLng);
            return Double.compare(score2, score1); // Descending
        });

        return profiles;
    }

    private double calculateScore(ProfileDto profile, List<String> userTags, Double userLat, Double userLng) {
        double jaccardScore = calculateJaccardSimilarity(profile, userTags);
        
        // Base score uses Jaccard Similarity heavily
        double finalScore = jaccardScore * 50.0;
        
        // Add exponential decay geo proximity boost if available
        if (userLat != null && userLng != null && profile.getLatitude() != null && profile.getLongitude() != null) {
            double distance = calculateDistance(userLat, userLng, profile.getLatitude(), profile.getLongitude());
            
            // Maximum boost for 0 distance is 40.0
            // Decay constant: distance / 30.0 (decreases by ~63% every 30km)
            double geoBoost = 40.0 * Math.exp(-distance / 30.0);
            
            finalScore += geoBoost;
        }

        return finalScore;
    }

    private double calculateJaccardSimilarity(ProfileDto profile, List<String> userTags) {
        if (userTags == null || userTags.isEmpty() || profile.getTags() == null || profile.getTags().isEmpty()) {
            return 0.0;
        }
        
        Set<String> uTags = new HashSet<>(userTags);
        Set<String> pTags = new HashSet<>(profile.getTags());
        
        Set<String> intersection = new HashSet<>(uTags);
        intersection.retainAll(pTags);
        
        Set<String> union = new HashSet<>(uTags);
        union.addAll(pTags);
        
        return (double) intersection.size() / union.size();
    }

    private double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        // Haversine formula
        final int R = 6371; // Radius of the earth in km
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; 
    }
}
