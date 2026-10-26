use crate::{
    error::AppError,
    middleware::auth::AuthUser,
    models::message::*,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use sqlx::Row;

async fn get_my_messages(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<DirectMessageResponse>>, AppError> {
    let group_rows = sqlx::query("SELECT group_id FROM group_members WHERE user_id = $1")
        .bind(auth.0)
        .fetch_all(&state.pool)
        .await?;

    let user_group_ids: Vec<i64> = group_rows.into_iter().map(|g| g.get("group_id")).collect();

    let rows = sqlx::query(
        r#"
        SELECT id, sender_id, receiver_id, group_id, chat_type, content, is_read, created_at
        FROM direct_messages
        WHERE sender_id = $1
           OR receiver_id = $1
           OR (group_id = ANY($2) AND chat_type = 'GROUP')
        ORDER BY created_at ASC
        "#,
    )
    .bind(auth.0)
    .bind(&user_group_ids)
    .fetch_all(&state.pool)
    .await?;

    let messages = rows
        .into_iter()
        .map(|r| DirectMessageResponse {
            id: r.get("id"),
            sender_id: r.get("sender_id"),
            receiver_id: r.get("receiver_id"),
            group_id: r.get("group_id"),
            chat_type: r.get("chat_type"),
            content: r.get("content"),
            is_read: r.get("is_read"),
            created_at: r.get("created_at"),
        })
        .collect();

    Ok(Json(messages))
}

async fn send_message(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SendMessagePayload>,
) -> Result<Json<DirectMessageResponse>, AppError> {
    let chat_type = if payload.chat_type.as_deref() == Some("GROUP") {
        "GROUP"
    } else if payload.group_id.is_some() {
        "JOIN_REQUEST"
    } else {
        "DIRECT_MESSAGE"
    };

    let receiver_id = if chat_type == "GROUP" {
        None
    } else {
        payload.receiver_id
    };

    let row = sqlx::query(
        r#"
        INSERT INTO direct_messages (sender_id, receiver_id, group_id, chat_type, content)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, sender_id, receiver_id, group_id, chat_type, content, is_read, created_at
        "#,
    )
    .bind(auth.0)
    .bind(receiver_id)
    .bind(payload.group_id)
    .bind(chat_type)
    .bind(&payload.content)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(DirectMessageResponse {
        id: row.get("id"),
        sender_id: row.get("sender_id"),
        receiver_id: row.get("receiver_id"),
        group_id: row.get("group_id"),
        chat_type: row.get("chat_type"),
        content: row.get("content"),
        is_read: row.get("is_read"),
        created_at: row.get("created_at"),
    }))
}

async fn mark_as_read(
    auth: AuthUser,
    Path(message_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query("UPDATE direct_messages SET is_read = true WHERE id = $1 AND receiver_id = $2")
        .bind(message_id)
        .bind(auth.0)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::OK)
}

async fn get_notifications(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<NotificationSummary>, AppError> {
    let unread_row = sqlx::query(
        "SELECT count(*) as count FROM direct_messages WHERE receiver_id = $1 AND is_read = false",
    )
    .bind(auth.0)
    .fetch_one(&state.pool)
    .await?;
    let unread_msgs: i64 = unread_row.get("count");

    let pending_row = sqlx::query(
        r#"
        SELECT count(*) as count
        FROM group_join_requests r
        JOIN habit_groups g ON g.id = r.group_id
        WHERE g.owner_id = $1 AND r.status = 'PENDING'
        "#,
    )
    .bind(auth.0)
    .fetch_one(&state.pool)
    .await?;
    let pending_reqs: i64 = pending_row.get("count");

    Ok(Json(NotificationSummary {
        unread_messages_count: unread_msgs as i32,
        pending_join_requests_count: pending_reqs as i32,
    }))
}

async fn delete_direct_chat(
    auth: AuthUser,
    Path(other_user_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query(
        r#"
        DELETE FROM direct_messages
        WHERE (sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1)
        "#,
    )
    .bind(auth.0)
    .bind(other_user_id)
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(get_my_messages).post(send_message))
        .route("/:id/read", post(mark_as_read))
        .route("/notifications", get(get_notifications))
        .route("/direct/:other_user_id", delete(delete_direct_chat))
}
