pub mod schema;

use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use tracing::{info, warn};

pub fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let masked_url = mask_db_url(database_url);
    info!("Initializing PostgreSQL connection pool for {}...", masked_url);

    let pool = PgPoolOptions::new()
        .max_connections(15)
        .min_connections(0)
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(300))
        .connect_lazy(database_url)?;

    Ok(pool)
}

pub async fn initialize_database_with_retries(pool: &PgPool) {
    let max_retries = 30; // 30 attempts x 5s = 2.5 minutes for Layerbase wake-up
    for attempt in 1..=max_retries {
        info!("Verifying database connectivity (attempt {}/{})...", attempt, max_retries);
        match sqlx::query("SELECT 1").execute(pool).await {
            Ok(_) => {
                info!("Database connectivity confirmed!");
                if let Err(e) = schema::run_migrations(pool).await {
                    tracing::error!("Failed to run schema migrations: {}", e);
                } else {
                    info!("Database migrations completed successfully!");
                }
                return;
            }
            Err(e) => {
                warn!(
                    "Database connection attempt {}/{} failed: {}. Database might be waking up from hibernation; retrying in 5s...",
                    attempt, max_retries, e
                );
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
    tracing::error!("Exceeded max database connection retries ({}). Database is unreachable.", max_retries);
}

fn mask_db_url(url: &str) -> String {
    if let Some(at_idx) = url.find('@') {
        if let Some(proto_end) = url.find("://") {
            let user_info_start = proto_end + 3;
            if user_info_start < at_idx {
                let user_info = &url[user_info_start..at_idx];
                if let Some(colon_idx) = user_info.find(':') {
                    let user = &user_info[..colon_idx];
                    return format!(
                        "{}://{}:*****@{}",
                        &url[..proto_end],
                        user,
                        &url[at_idx + 1..]
                    );
                }
            }
        }
    }
    url.to_string()
}

