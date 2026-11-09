use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    pub frontend_urls: Vec<String>,
    pub meilisearch_host: String,
    pub meilisearch_api_key: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub gemini_api_key: Option<String>,
    pub gemini_api_url: String,
    pub app_base_url: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8080);

        // Compute Database URL:
        // Priority 1: DATABASE_URL
        // Priority 2: DB_URL (from existing .env)
        // Priority 3: DB_URL_USERS
        // Priority 4: Constructed from DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD, DB_SSLMODE
        let database_url = if let Ok(url) = env::var("DATABASE_URL") {
            clean_jdbc_url(&url)
        } else if let Ok(url) = env::var("DB_URL") {
            clean_jdbc_url(&url)
        } else if let Ok(url) = env::var("DB_URL_USERS") {
            clean_jdbc_url(&url)
        } else {
            let host = env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
            let db_port = env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
            let name = env::var("DB_NAME").unwrap_or_else(|_| "habition_users".to_string());
            let user = env::var("DB_USERNAME").unwrap_or_else(|_| "postgres".to_string());
            let pass = env::var("DB_PASSWORD").unwrap_or_else(|_| "postgres".to_string());
            let sslmode = env::var("DB_SSLMODE").unwrap_or_else(|_| "prefer".to_string());

            format!("postgres://{}:{}@{}:{}/{}?sslmode={}", user, pass, host, db_port, name, sslmode)
        };

        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970".to_string());

        let frontend_urls_raw = env::var("FRONTEND_URLS")
            .unwrap_or_else(|_| env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5173,http://localhost:5174".to_string()));
        let frontend_urls = frontend_urls_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let meilisearch_enabled = env::var("ENABLE_MEILISEARCH")
            .map(|v| v != "false" && v != "0" && v != "no")
            .unwrap_or(true);

        let meilisearch_host = if !meilisearch_enabled {
            "".to_string()
        } else {
            let host = env::var("MEILISEARCH_HOST")
                .unwrap_or_else(|_| "http://127.0.0.1:7700".to_string());
            if host == "none" || host == "disabled" {
                "".to_string()
            } else {
                host
            }
        };

        let meilisearch_api_key = env::var("MEILISEARCH_API_KEY")
            .or_else(|_| env::var("MEILISEARCH_MASTER_KEY"))
            .unwrap_or_else(|_| "".to_string());

        let smtp_host = env::var("SPRING_MAIL_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());
        let smtp_port = env::var("SPRING_MAIL_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(587);
        let smtp_username = env::var("SPRING_MAIL_USERNAME").ok().filter(|s| !s.is_empty());
        let smtp_password = env::var("SPRING_MAIL_PASSWORD").ok().filter(|s| !s.is_empty());

        let gemini_api_key = env::var("GEMINI_API_KEY").ok().filter(|s| !s.is_empty());
        let gemini_api_url = env::var("GEMINI_API_URL").unwrap_or_else(|_| {
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent".to_string()
        });

        let app_base_url = env::var("API_GATEWAY_URL")
            .or_else(|_| env::var("APP_BASE_URL"))
            .unwrap_or_else(|_| format!("http://localhost:{}", port));

        Self {
            port,
            database_url,
            jwt_secret,
            frontend_urls,
            meilisearch_host,
            meilisearch_api_key,
            smtp_host,
            smtp_port,
            smtp_username,
            smtp_password,
            gemini_api_key,
            gemini_api_url,
            app_base_url,
        }
    }
}

fn clean_jdbc_url(url: &str) -> String {
    // If user has jdbc:postgresql://... convert to postgres://...
    if url.starts_with("jdbc:postgresql://") {
        url.replacen("jdbc:postgresql://", "postgres://", 1)
    } else if url.starts_with("jdbc:postgres://") {
        url.replacen("jdbc:postgres://", "postgres://", 1)
    } else {
        url.to_string()
    }
}

