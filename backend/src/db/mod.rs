pub mod schema;

use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;
use tracing::{info, warn};

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let masked_url = mask_db_url(database_url);
    info!("Connecting to PostgreSQL database at {}...", masked_url);

    let max_retries = 6;
    let mut last_err = None;

    for attempt in 1..=max_retries {
        info!("Attempting database connection ({}/{})...", attempt, max_retries);

        let pool_res = PgPoolOptions::new()
            .max_connections(10)
            .min_connections(0)
            .acquire_timeout(Duration::from_secs(20))
            .idle_timeout(Duration::from_secs(300))
            .connect(database_url)
            .await;

        match pool_res {
            Ok(pool) => {
                match sqlx::query("SELECT 1").execute(&pool).await {
                    Ok(_) => {
                        info!("Database connection established successfully!");
                        return Ok(pool);
                    }
                    Err(e) => {
                        warn!("Database ping failed on attempt {}: {}. Retrying in 4s...", attempt, e);
                        last_err = Some(e);
                    }
                }
            }
            Err(e) => {
                warn!(
                    "Connection attempt {} failed: {}. Database might be waking up from hibernation; retrying in 4s...",
                    attempt, e
                );
                last_err = Some(e);
            }
        }

        if attempt < max_retries {
            tokio::time::sleep(Duration::from_secs(4)).await;
        }
    }

    Err(last_err.unwrap())
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

