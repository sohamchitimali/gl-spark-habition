use crate::{
    error::AppError,
    middleware::auth::AuthUser,
    models::notification::*,
    services::{
        email::send_email,
        scheduler::{compute_next_slot, validate_window},
    },
    state::AppState,
};
use axum::{
    extract::{Query, State},
    response::Html,
    routing::{get, post},
    Form, Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::NaiveDateTime;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateWindowQuery {
    pub window_start: String,
    pub window_end: String,
    pub frequency: i32,
}

#[derive(Debug, Deserialize)]
pub struct UnsubscribeParams {
    pub user_id: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UnsubscribeForm {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub token: String,
}

async fn get_settings(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let row = sqlx::query(
        r#"
        SELECT timezone, window_start, window_end, frequency, next_execution_at
        FROM notification_schedules
        WHERE user_id = $1
        "#,
    )
    .bind(auth.0.to_string())
    .fetch_optional(&state.pool)
    .await?;

    if let Some(s) = row {
        let tz: String = s.get("timezone");
        let ws: String = s.get("window_start");
        let we: String = s.get("window_end");
        let freq: i32 = s.get("frequency");
        let next_dt: NaiveDateTime = s.get("next_execution_at");

        Ok(Json(json!({
            "enabled": true,
            "timezone": tz,
            "windowStart": ws,
            "windowEnd": we,
            "frequency": freq,
            "nextExecutionAt": next_dt
        })))
    } else {
        Ok(Json(json!({ "enabled": false })))
    }
}

async fn create_settings(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<NotificationSettingsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tz = payload.timezone.unwrap_or_else(|| "UTC".to_string());
    let ws = payload.window_start.unwrap_or_else(|| "09:00".to_string());
    let we = payload.window_end.unwrap_or_else(|| "21:00".to_string());
    let freq = payload.frequency.unwrap_or(3);

    validate_window(&ws, &we, freq).map_err(AppError::BadRequest)?;
    let next_slot = compute_next_slot(&tz, &ws, &we, freq, 0).map_err(AppError::BadRequest)?;

    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO notification_schedules (id, user_id, timezone, window_start, window_end, frequency, next_execution_at, current_cycle_index, version)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)
        ON CONFLICT (user_id) DO UPDATE SET
            timezone = $3,
            window_start = $4,
            window_end = $5,
            frequency = $6,
            next_execution_at = $7,
            version = notification_schedules.version + 1
        "#,
    )
    .bind(id)
    .bind(auth.0.to_string())
    .bind(tz)
    .bind(ws)
    .bind(we)
    .bind(freq)
    .bind(next_slot)
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "status": "created" })))
}

async fn update_settings(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<NotificationSettingsRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let tz = payload.timezone.unwrap_or_else(|| "UTC".to_string());
    let ws = payload.window_start.unwrap_or_else(|| "09:00".to_string());
    let we = payload.window_end.unwrap_or_else(|| "21:00".to_string());
    let freq = payload.frequency.unwrap_or(3);

    validate_window(&ws, &we, freq).map_err(AppError::BadRequest)?;

    sqlx::query(
        r#"
        UPDATE notification_schedules
        SET timezone = $1, window_start = $2, window_end = $3, frequency = $4, version = version + 1
        WHERE user_id = $5
        "#,
    )
    .bind(tz)
    .bind(ws)
    .bind(we)
    .bind(freq)
    .bind(auth.0.to_string())
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({
        "status": "updated",
        "note": "Settings will take effect from your next scheduled cycle"
    })))
}

async fn delete_settings(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM notification_schedules WHERE user_id = $1")
        .bind(auth.0.to_string())
        .execute(&state.pool)
        .await?;

    Ok(Json(json!({ "status": "cancelled" })))
}

async fn validate_window_route(
    Query(query): Query<ValidateWindowQuery>,
) -> Json<serde_json::Value> {
    match validate_window(&query.window_start, &query.window_end, query.frequency) {
        Ok(_) => Json(json!({ "valid": true })),
        Err(e) => Json(json!({ "valid": false, "error": e })),
    }
}

async fn trigger_test_notification(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user = sqlx::query("SELECT email, username FROM users WHERE id = $1")
        .bind(auth.0)
        .fetch_one(&state.pool)
        .await?;

    let email: String = user.get("email");
    let uname: Option<String> = user.get("username");

    let subject = "Test Habit Notification from Habition";
    let body = format!(
        "<p>Hi <strong>{}</strong>,</p><p>This is a test notification confirming that email delivery is working smoothly!</p>",
        uname.as_deref().unwrap_or("Friend")
    );

    send_email(&state.config, &email, subject, &body).await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to send email: {}", e)))?;

    Ok(Json(json!({ "status": "test_triggered" })))
}

async fn unsubscribe_page(
    Query(params): Query<UnsubscribeParams>,
    State(state): State<AppState>,
) -> Html<String> {
    let uid = params.user_id.unwrap_or_default();
    let tok = params.token.unwrap_or_default();

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribe — Habition</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               display: flex; align-items: center; justify-content: center;
               min-height: 100vh; margin: 0; background: #0f0f14; color: #e0e0e0; }}
        .card {{ background: #1a1a24; border: 1px solid #2a2a3a; border-radius: 16px;
                padding: 40px; max-width: 420px; text-align: center; }}
        h1 {{ font-size: 1.5rem; margin-bottom: 8px; }}
        p {{ color: #a0a0b0; margin-bottom: 24px; }}
        button {{ background: #e03e3e; color: white; border: none; padding: 12px 32px;
                 border-radius: 8px; font-size: 1rem; cursor: pointer; }}
        button:hover {{ background: #c03030; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>Unsubscribe from Habition Emails?</h1>
        <p>You'll no longer receive daily habit reminders. You can re-enable this anytime from your profile settings.</p>
        <form method="POST" action="{}/notifications/unsubscribe">
            <input type="hidden" name="userId" value="{}"/>
            <input type="hidden" name="token" value="{}"/>
            <button type="submit">Confirm Unsubscribe</button>
        </form>
    </div>
</body>
</html>"#,
        state.config.app_base_url, uid, tok
    );

    Html(html)
}

async fn process_unsubscribe(
    State(state): State<AppState>,
    Form(form): Form<UnsubscribeForm>,
) -> Result<Html<String>, AppError> {
    let expected = URL_SAFE_NO_PAD.encode(format!("{}:unsubscribe", form.user_id));
    if form.token != expected {
        return Err(AppError::BadRequest("Invalid unsubscribe token".to_string()));
    }

    if let Ok(uid) = form.user_id.parse::<i64>() {
        sqlx::query("UPDATE users SET email_notifications_enabled = false WHERE id = $1")
            .bind(uid)
            .execute(&state.pool)
            .await?;

        sqlx::query("DELETE FROM notification_schedules WHERE user_id = $1")
            .bind(&form.user_id)
            .execute(&state.pool)
            .await?;
    }

    Ok(Html(r#"
        <!DOCTYPE html>
        <html><head><title>Unsubscribed</title>
        <style>body { font-family: sans-serif; background: #0f0f14; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }</style>
        </head><body><div style="text-align: center;"><h1>You have been unsubscribed</h1><p>You won't receive habit reminder emails anymore.</p></div></body></html>
    "#.to_string()))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/settings", get(get_settings).post(create_settings).put(update_settings).delete(delete_settings))
        .route("/settings/validate", get(validate_window_route))
        .route("/settings/test", post(trigger_test_notification))
        .route("/unsubscribe", get(unsubscribe_page).post(process_unsubscribe))
}

