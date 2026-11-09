mod config;
mod db;
mod error;
mod middleware;
mod models;
mod routes;
mod services;
mod state;
mod utils;

use axum::http::{
    header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    HeaderName, HeaderValue, Method,
};
use config::AppConfig;
use state::AppState;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "habition_backend=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("==================================================");
    info!(" Starting Habition Rust Unified Backend           ");
    info!(" Ultra-lean, memory-efficient (<30MB RAM)         ");
    info!("==================================================");

    let config = AppConfig::from_env();
    info!("Loaded configuration for port {}", config.port);

    // Database initialization
    let pool = db::create_pool(&config.database_url).await?;
    db::schema::run_migrations(&pool).await?;

    // Create shared state
    let state = AppState::new(pool.clone(), config.clone());

    // Start background scheduler
    services::scheduler::start_scheduler(
        pool.clone(),
        state.config.clone(),
        state.http_client.clone(),
    );

    // Initial background Meilisearch index synchronization
    let sync_pool = pool.clone();
    let sync_config = state.config.clone();
    let sync_client = state.http_client.clone();
    tokio::spawn(async move {
        services::search::initial_sync_to_meilisearch(&sync_pool, &sync_config, &sync_client).await;
    });

    // Setup CORS
    let x_user_id = HeaderName::from_static("x-user-id");
    let x_timezone = HeaderName::from_static("x-timezone");

    let allowed_origins: Vec<HeaderValue> = config
        .frontend_urls
        .iter()
        .filter_map(|url| url.parse::<HeaderValue>().ok())
        .collect();

    let cors = if allowed_origins.is_empty() {
        CorsLayer::permissive()
    } else {
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(allowed_origins))
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                AUTHORIZATION,
                CONTENT_TYPE,
                ACCEPT,
                x_user_id,
                x_timezone,
            ])
            .allow_credentials(true)
    };

    // Assemble routers
    let app = axum::Router::new()
        .merge(routes::health::router())
        .nest("/auth", routes::auth::router())
        .nest("/groups", routes::groups::router())
        .merge(routes::habits::router())
        .merge(routes::coins::router())
        .nest("/messages", routes::messages::router())
        .nest("/notifications", routes::notifications::router())
        .nest("/api/insights", routes::insights::router())
        .nest("/insights", routes::insights::router())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    info!("Habition Rust backend binding to {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Server listening and ready for requests on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
