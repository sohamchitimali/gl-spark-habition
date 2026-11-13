use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub port: u16,
    pub database_url: String,
    pub jwt_secret: String,
    #[allow(dead_code)]
    pub hmac_secret: String,
    #[allow(dead_code)]
    pub otp_secret: String,
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
    pub google_client_id: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        dotenvy::dotenv().ok();

        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8080);

        // Compute Database URL:
        // Priority 1: DATABASE_URL (if provided and non-empty)
        // Priority 2: DB_HOST if remote (e.g. Layerbase/cloud) -> builds from DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD, DB_SSLMODE
        // Priority 3: DB_URL (if provided and non-empty)
        // Priority 4: DB_URL_USERS (if provided and non-empty)
        // Priority 5: Local DB_HOST / fallback
        let database_url = if let Some(url) = env::var("DATABASE_URL").ok().filter(|s| !s.trim().is_empty()) {
            clean_jdbc_url(&url)
        } else if let Some(host) = env::var("DB_HOST").ok().filter(|s| !s.trim().is_empty() && s.trim() != "localhost") {
            let db_port = env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
            let name = env::var("DB_NAME").unwrap_or_else(|_| "postgres".to_string());
            let user = env::var("DB_USERNAME").unwrap_or_else(|_| "postgres".to_string());
            let pass = env::var("DB_PASSWORD").unwrap_or_else(|_| "".to_string());
            let sslmode = env::var("DB_SSLMODE").unwrap_or_else(|_| "require".to_string());

            let encoded_user = urlencoding_simple(&user);
            let encoded_pass = urlencoding_simple(&pass);

            format!("postgres://{}:{}@{}:{}/{}?sslmode={}", encoded_user, encoded_pass, host, db_port, name, sslmode)
        } else if let Some(url) = env::var("DB_URL").ok().filter(|s| !s.trim().is_empty()) {
            clean_jdbc_url(&url)
        } else if let Some(url) = env::var("DB_URL_USERS").ok().filter(|s| !s.trim().is_empty()) {
            clean_jdbc_url(&url)
        } else {
            let host = env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string());
            let db_port = env::var("DB_PORT").unwrap_or_else(|_| "5432".to_string());
            let name = env::var("DB_NAME").unwrap_or_else(|_| "habition_users".to_string());
            let user = env::var("DB_USERNAME").unwrap_or_else(|_| "postgres".to_string());
            let pass = env::var("DB_PASSWORD").unwrap_or_else(|_| "root".to_string());
            let sslmode = env::var("DB_SSLMODE").unwrap_or_else(|_| "disable".to_string());

            let encoded_user = urlencoding_simple(&user);
            let encoded_pass = urlencoding_simple(&pass);

            format!("postgres://{}:{}@{}:{}/{}?sslmode={}", encoded_user, encoded_pass, host, db_port, name, sslmode)
        };

        let jwt_secret = env::var("JWT_SECRET")
            .unwrap_or_else(|_| "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970".to_string());

        let hmac_secret = env::var("HMAC_SECRET")
            .unwrap_or_else(|_| "default-dev-secret-key-123456".to_string());

        let otp_secret = env::var("OTP_SECRET")
            .unwrap_or_else(|_| "3b497a6d9e81b672a9b3d0c4f826317b".to_string());

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

        let google_client_id = env::var("GOOGLE_CLIENT_ID")
            .ok()
            .filter(|s| !s.trim().is_empty());

        Self {
            port,
            database_url,
            jwt_secret,
            hmac_secret,
            otp_secret,
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
            google_client_id,
        }
    }
}

fn clean_jdbc_url(url: &str) -> String {
    let clean = url.trim().trim_matches('"').trim_matches('\'');
    // If user has jdbc:postgresql://... convert to postgres://...
    if clean.starts_with("jdbc:postgresql://") {
        clean.replacen("jdbc:postgresql://", "postgres://", 1)
    } else if clean.starts_with("jdbc:postgres://") {
        clean.replacen("jdbc:postgres://", "postgres://", 1)
    } else {
        clean.to_string()
    }
}

fn urlencoding_simple(s: &str) -> String {
    let mut encoded = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

