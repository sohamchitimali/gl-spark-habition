package test;
import com.meilisearch.sdk.Client;
import com.meilisearch.sdk.Config;
import com.meilisearch.sdk.Index;
import com.meilisearch.sdk.SearchRequest;
import com.meilisearch.sdk.model.SearchResult;
import com.meilisearch.sdk.model.Searchable;

public class TestMeili {
    public static void main(String[] args) throws Exception {
        String host = System.getenv().getOrDefault("MEILISEARCH_HOST", "http://localhost:7700");
        String apiKey = System.getenv().getOrDefault("MEILISEARCH_MASTER_KEY", "");
        Client client = new Client(new Config(host, apiKey));
        Index index = client.index("users");
        SearchRequest req = SearchRequest.builder().q("").build();
        Searchable searchable = index.search(req);
        System.out.println("Class: " + searchable.getClass().getName());
        if (searchable instanceof SearchResult) {
            System.out.println("Is SearchResult");
        } else {
            System.out.println("Is NOT SearchResult");
        }
    }
}
