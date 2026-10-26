use crate::{
    error::AppError,
    middleware::auth::AuthUser,
    models::notification::{GroupInsightDTO, UserInsightDTO},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use sqlx::Row;

async fn get_group_insights(
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<GroupInsightDTO>, AppError> {
    let avg_row = sqlx::query(
        "SELECT AVG(completion_percentage)::float8 as score FROM heatmap_records WHERE group_id = $1",
    )
    .bind(group_id)
    .fetch_one(&state.pool)
    .await?;

    let avg: f64 = avg_row.get::<Option<f64>, _>("score").unwrap_or(75.0);

    let status = if avg >= 80.0 {
        "EXCELLENT"
    } else if avg >= 50.0 {
        "HEALTHY"
    } else {
        "AT_RISK"
    };

    let performer_rows = sqlx::query(
        r#"
        SELECT u.username
        FROM group_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.group_id = $1
        ORDER BY m.total_coins DESC
        LIMIT 3
        "#,
    )
    .bind(group_id)
    .fetch_all(&state.pool)
    .await?;

    let performers = performer_rows
        .into_iter()
        .filter_map(|r| r.get::<Option<String>, _>("username"))
        .collect();

    Ok(Json(GroupInsightDTO {
        group_id,
        health_status: status.to_string(),
        overall_consistency_score: avg,
        top_performers: performers,
        struggling_members: Vec::new(),
        suggested_action: "Encourage members to check off today's habits to boost group rank!".to_string(),
    }))
}

async fn get_user_insights(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<UserInsightDTO>, AppError> {
    let avg_row = sqlx::query(
        "SELECT AVG(completion_percentage)::float8 as score FROM heatmap_records WHERE user_id = $1 AND group_id IS NULL",
    )
    .bind(auth.0)
    .fetch_one(&state.pool)
    .await?;

    let avg: f64 = avg_row.get::<Option<f64>, _>("score").unwrap_or(80.0);

    let mut achievements = Vec::new();
    let comp_row = sqlx::query("SELECT count(*) as count FROM habit_completions WHERE user_id = $1")
        .bind(auth.0)
        .fetch_one(&state.pool)
        .await?;
    let total_completions: i64 = comp_row.get("count");

    if total_completions > 0 {
        achievements.push(format!("Completed {} habit check-ins total!", total_completions));
    }

    Ok(Json(UserInsightDTO {
        user_id: auth.0,
        personal_consistency_score: avg,
        recent_achievements: achievements,
        areas_for_improvement: vec!["Evening habits completion".to_string()],
        predicted_next_milestone: "7-Day Streak Milestone (+50 Coins bonus)".to_string(),
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/groups/:id", get(get_group_insights))
        .route("/users/me", get(get_user_insights))
}

