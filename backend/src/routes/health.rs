use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "UP",
        "service": "habition-backend",
        "engine": "rust-axum"
    }))
}

pub fn router() -> Router<crate::state::AppState> {
    Router::new()
        .route("/health", get(health_check))
        .route("/actuator/health", get(health_check))
}

