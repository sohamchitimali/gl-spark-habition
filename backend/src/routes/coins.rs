use crate::{
    error::AppError,
    models::coin::*,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use sqlx::Row;

async fn credit_coins(
    State(state): State<AppState>,
    Json(payload): Json<CreditCoinsRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let row = sqlx::query(
        r#"
        INSERT INTO coin_transactions (user_id, amount, reason, group_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#,
    )
    .bind(payload.user_id)
    .bind(payload.amount)
    .bind(&payload.reason)
    .bind(payload.group_id)
    .fetch_one(&state.pool)
    .await?;

    let tid: i64 = row.get("id");

    if let Some(gid) = payload.group_id {
        let _ = sqlx::query(
            "UPDATE group_members SET total_coins = total_coins + $1 WHERE group_id = $2 AND user_id = $3",
        )
        .bind(payload.amount)
        .bind(gid)
        .bind(payload.user_id)
        .execute(&state.pool)
        .await;
    }

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": tid,
            "userId": payload.user_id,
            "amount": payload.amount,
            "reason": payload.reason,
            "groupId": payload.group_id
        })),
    ))
}

async fn get_leaderboard(
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<LeaderboardResponse>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT user_id, total_coins, previous_rank
        FROM group_members
        WHERE group_id = $1
        ORDER BY total_coins DESC, joined_at ASC
        "#,
    )
    .bind(group_id)
    .fetch_all(&state.pool)
    .await?;

    let mut entries = Vec::new();
    let mut current_rank = 1;
    let mut previous_coins = -1;

    for (i, r) in rows.iter().enumerate() {
        let uid: i64 = r.get("user_id");
        let coins: i32 = r.get::<Option<i32>, _>("total_coins").unwrap_or(0);
        let prev_rank: Option<i32> = r.get("previous_rank");

        if i > 0 && coins < previous_coins {
            current_rank = (i + 1) as i32;
        }
        previous_coins = coins;

        entries.push(LeaderboardEntry {
            rank: current_rank,
            previous_rank: prev_rank,
            user_id: uid,
            total_coins: coins,
        });
    }

    let winner_id = entries.first().map(|e| e.user_id);

    Ok(Json(LeaderboardResponse {
        group_id,
        entries,
        winner_id,
    }))
}

async fn get_user_balance(
    Path(user_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<i32>, AppError> {
    let row = sqlx::query(
        "SELECT COALESCE(SUM(amount), 0)::int4 as total FROM coin_transactions WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    let total: i32 = row.get("total");
    Ok(Json(total))
}

async fn reset_group_coins(
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query("UPDATE group_members SET total_coins = 0, previous_rank = NULL WHERE group_id = $1")
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    sqlx::query("DELETE FROM coin_transactions WHERE group_id = $1")
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn finalize_competition(
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<LeaderboardResponse>, AppError> {
    let leaderboard = get_leaderboard(Path(group_id), State(state)).await?.0;
    Ok(Json(leaderboard))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/coins/credit", post(credit_coins))
        .route("/coins/groups/:group_id/leaderboard", get(get_leaderboard))
        .route("/coins/users/:user_id/balance", get(get_user_balance))
        .route("/coins/groups/:group_id/reset", delete(reset_group_coins))
        .route("/competitions/:group_id/finalize", post(finalize_competition))
}
