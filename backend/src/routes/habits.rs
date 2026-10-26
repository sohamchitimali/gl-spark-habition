use crate::{
    error::AppError,
    middleware::auth::AuthUser,
    models::habit::*,
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::{Duration, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;

#[derive(Debug, Deserialize)]
pub struct CreateHabitParams {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupHabitParams {
    pub group_id: i64,
    pub group_habit_id: i64,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsistencyQuery {
    pub user_id: Option<i64>,
}

async fn create_personal_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<CreateHabitParams>,
) -> Result<(StatusCode, Json<HabitResponse>), AppError> {
    let row = sqlx::query(
        r#"
        INSERT INTO habits (title, description, user_id, created_at)
        VALUES ($1, $2, $3, CURRENT_DATE)
        RETURNING id, title, description, user_id, group_id, group_habit_id
        "#,
    )
    .bind(&query.title)
    .bind(&query.description)
    .bind(auth.0)
    .fetch_one(&state.pool)
    .await?;

    let hid: i64 = row.get("id");
    let title: String = row.get("title");
    let desc: Option<String> = row.get("description");
    let uid: i64 = row.get("user_id");

    Ok((
        StatusCode::CREATED,
        Json(HabitResponse {
            id: hid,
            title,
            description: desc,
            user_id: uid,
            group_id: None,
            group_habit_id: None,
            completed_today: false,
            tasks: Vec::new(),
        }),
    ))
}

async fn create_group_tracking_habit(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<CreateGroupHabitParams>,
) -> Result<(StatusCode, Json<HabitResponse>), AppError> {
    let row = sqlx::query(
        r#"
        INSERT INTO habits (title, description, user_id, group_id, group_habit_id, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
        RETURNING id, title, description, user_id, group_id, group_habit_id
        "#,
    )
    .bind(&query.title)
    .bind(&query.description)
    .bind(auth.0)
    .bind(query.group_id)
    .bind(query.group_habit_id)
    .fetch_one(&state.pool)
    .await?;

    let hid: i64 = row.get("id");
    let title: String = row.get("title");
    let desc: Option<String> = row.get("description");
    let uid: i64 = row.get("user_id");
    let gid: Option<i64> = row.get("group_id");
    let ghid: Option<i64> = row.get("group_habit_id");

    Ok((
        StatusCode::CREATED,
        Json(HabitResponse {
            id: hid,
            title,
            description: desc,
            user_id: uid,
            group_id: gid,
            group_habit_id: ghid,
            completed_today: false,
            tasks: Vec::new(),
        }),
    ))
}

async fn get_habits_for_user(
    Path(user_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<Vec<HabitResponse>>, AppError> {
    let today = Utc::now().date_naive();

    let habit_rows = sqlx::query(
        r#"
        SELECT id, title, description, user_id, group_id, group_habit_id
        FROM habits
        WHERE user_id = $1
        ORDER BY id ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

    let mut responses = Vec::new();
    for h in habit_rows {
        let hid: i64 = h.get("id");
        let title: String = h.get("title");
        let desc: Option<String> = h.get("description");
        let uid: i64 = h.get("user_id");
        let gid: Option<i64> = h.get("group_id");
        let ghid: Option<i64> = h.get("group_habit_id");

        let completed = sqlx::query(
            "SELECT id FROM habit_completions WHERE habit_id = $1 AND user_id = $2 AND completion_date = $3",
        )
        .bind(hid)
        .bind(user_id)
        .bind(today)
        .fetch_optional(&state.pool)
        .await?
        .is_some();

        let tasks = fetch_tasks_with_lazy_reset(&state.pool, hid, today).await?;

        responses.push(HabitResponse {
            id: hid,
            title,
            description: desc,
            user_id: uid,
            group_id: gid,
            group_habit_id: ghid,
            completed_today: completed,
            tasks,
        });
    }

    Ok(Json(responses))
}

async fn delete_habit(
    Path(habit_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM habits WHERE id = $1")
        .bind(habit_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn complete_habit(
    auth: AuthUser,
    Path(habit_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<CompleteHabitResponse>, AppError> {
    let habit = sqlx::query("SELECT id, title, user_id, group_id FROM habits WHERE id = $1")
        .bind(habit_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Habit not found".to_string()))?;

    let habit_title: String = habit.get("title");
    let habit_user_id: i64 = habit.get("user_id");
    let habit_group_id: Option<i64> = habit.get("group_id");

    let today = Utc::now().date_naive();

    let already_done = sqlx::query(
        "SELECT id FROM habit_completions WHERE habit_id = $1 AND user_id = $2 AND completion_date = $3",
    )
    .bind(habit_id)
    .bind(auth.0)
    .bind(today)
    .fetch_optional(&state.pool)
    .await?;

    if already_done.is_some() {
        return Err(AppError::Conflict("Habit already completed today".to_string()));
    }

    let pending_tasks_row = sqlx::query(
        "SELECT count(*) as count FROM habit_tasks WHERE habit_id = $1 AND completed = false",
    )
    .bind(habit_id)
    .fetch_one(&state.pool)
    .await?;

    let pending_tasks: i64 = pending_tasks_row.get("count");
    if pending_tasks > 0 {
        return Err(AppError::UnprocessableEntity(
            "Complete all tasks before marking this habit done".to_string(),
        ));
    }

    sqlx::query(
        r#"
        INSERT INTO habit_completions (habit_id, user_id, completion_date, completed_at)
        VALUES ($1, $2, $3, NOW())
        "#,
    )
    .bind(habit_id)
    .bind(auth.0)
    .bind(today)
    .execute(&state.pool)
    .await?;

    update_heatmap_record(&state.pool, habit_user_id, habit_group_id, today).await?;
    update_streak_snapshots(&state.pool, auth.0, today).await?;

    let streak = calculate_streak(&state.pool, auth.0, None).await?;

    let mut coins_earned = 1;
    if streak > 0 && streak % 7 == 0 {
        coins_earned += 50;
    }

    let reason = format!("Habit completion: {}", habit_title);
    sqlx::query(
        r#"
        INSERT INTO coin_transactions (user_id, amount, reason, group_id)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(auth.0)
    .bind(coins_earned)
    .bind(&reason)
    .bind(habit_group_id)
    .execute(&state.pool)
    .await?;

    if let Some(gid) = habit_group_id {
        let _ = sqlx::query(
            "UPDATE group_members SET total_coins = total_coins + $1 WHERE group_id = $2 AND user_id = $3",
        )
        .bind(coins_earned)
        .bind(gid)
        .bind(auth.0)
        .execute(&state.pool)
        .await;
    }

    Ok(Json(CompleteHabitResponse {
        habit_id,
        completed_on: today,
        current_streak: streak,
        coins_earned,
    }))
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

async fn create_task(
    Path(habit_id): Path<i64>,
    State(state): State<AppState>,
    Json(payload): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<HabitTaskResponse>), AppError> {
    let row = sqlx::query(
        r#"
        INSERT INTO habit_tasks (habit_id, title, completed)
        VALUES ($1, $2, false)
        RETURNING id, habit_id, title, completed
        "#,
    )
    .bind(habit_id)
    .bind(&payload.title)
    .fetch_one(&state.pool)
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(HabitTaskResponse {
            id: row.get("id"),
            habit_id: row.get("habit_id"),
            title: row.get("title"),
            completed: row.get("completed"),
        }),
    ))
}

async fn get_tasks(
    Path(habit_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<Vec<HabitTaskResponse>>, AppError> {
    let today = Utc::now().date_naive();
    let tasks = fetch_tasks_with_lazy_reset(&state.pool, habit_id, today).await?;
    Ok(Json(tasks))
}

async fn toggle_task(
    Path(task_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<HabitTaskResponse>, AppError> {
    let today = Utc::now().date_naive();

    let task = sqlx::query("SELECT id, habit_id, title, completed FROM habit_tasks WHERE id = $1")
        .bind(task_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Task not found".to_string()))?;

    let habit_id: i64 = task.get("habit_id");
    let title: String = task.get("title");
    let curr_comp: bool = task.get("completed");
    let new_completed = !curr_comp;
    let last_completed_date = if new_completed { Some(today) } else { None };

    sqlx::query("UPDATE habit_tasks SET completed = $1, last_completed_date = $2 WHERE id = $3")
        .bind(new_completed)
        .bind(last_completed_date)
        .bind(task_id)
        .execute(&state.pool)
        .await?;

    if let Ok(Some(h)) = sqlx::query("SELECT user_id, group_id FROM habits WHERE id = $1").bind(habit_id).fetch_optional(&state.pool).await {
        let uid: i64 = h.get("user_id");
        let gid: Option<i64> = h.get("group_id");
        let _ = update_heatmap_record(&state.pool, uid, gid, today).await;
    }

    Ok(Json(HabitTaskResponse {
        id: task_id,
        habit_id,
        title,
        completed: new_completed,
    }))
}

async fn delete_task(
    Path(task_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM habit_tasks WHERE id = $1")
        .bind(task_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ─── Heatmaps & Streaks ──────────────────────────────────────────────────────

async fn get_user_heatmap(
    Path(user_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<HeatmapResponse>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT record_date, completion_percentage
        FROM heatmap_records
        WHERE user_id = $1 AND group_id IS NULL
        ORDER BY record_date DESC
        LIMIT 365
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

    let days = rows
        .into_iter()
        .map(|r| HeatmapDay {
            date: r.get("record_date"),
            completion_percentage: r.get("completion_percentage"),
        })
        .collect();

    Ok(Json(HeatmapResponse {
        user_id: Some(user_id),
        group_id: None,
        days,
    }))
}

async fn get_group_heatmap(
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<HeatmapResponse>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT record_date, completion_percentage
        FROM heatmap_records
        WHERE group_id = $1 AND user_id IS NULL
        ORDER BY record_date DESC
        LIMIT 365
        "#,
    )
    .bind(group_id)
    .fetch_all(&state.pool)
    .await?;

    let days = rows
        .into_iter()
        .map(|r| HeatmapDay {
            date: r.get("record_date"),
            completion_percentage: r.get("completion_percentage"),
        })
        .collect();

    Ok(Json(HeatmapResponse {
        user_id: None,
        group_id: Some(group_id),
        days,
    }))
}

async fn get_user_group_heatmap(
    Path((group_id, user_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<Json<HeatmapResponse>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT record_date, completion_percentage
        FROM heatmap_records
        WHERE group_id = $1 AND user_id = $2
        ORDER BY record_date DESC
        LIMIT 365
        "#,
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

    let days = rows
        .into_iter()
        .map(|r| HeatmapDay {
            date: r.get("record_date"),
            completion_percentage: r.get("completion_percentage"),
        })
        .collect();

    Ok(Json(HeatmapResponse {
        user_id: Some(user_id),
        group_id: Some(group_id),
        days,
    }))
}

async fn get_user_streak(
    Path(user_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<StreakResponse>, AppError> {
    let current_streak = calculate_streak(&state.pool, user_id, None).await?;
    let personal_best = calculate_personal_best(&state.pool, user_id, None).await?;
    let today = Utc::now().date_naive();
    let today_earned = evaluate_streak_for_date(&state.pool, user_id, None, today).await?;

    Ok(Json(StreakResponse {
        user_id,
        current_streak,
        personal_best,
        today_earned,
    }))
}

async fn get_group_streak(
    Path((group_id, user_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<Json<StreakResponse>, AppError> {
    let current_streak = calculate_streak(&state.pool, user_id, Some(group_id)).await?;
    let personal_best = calculate_personal_best(&state.pool, user_id, Some(group_id)).await?;
    let today = Utc::now().date_naive();
    let today_earned = evaluate_streak_for_date(&state.pool, user_id, Some(group_id), today).await?;

    Ok(Json(StreakResponse {
        user_id,
        current_streak,
        personal_best,
        today_earned,
    }))
}

async fn get_personal_consistency(
    Query(query): Query<ConsistencyQuery>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let uid = query.user_id.unwrap_or(0);
    let avg_row = sqlx::query(
        "SELECT AVG(completion_percentage)::float8 as avg_score FROM heatmap_records WHERE user_id = $1 AND group_id IS NULL",
    )
    .bind(uid)
    .fetch_one(&state.pool)
    .await?;

    let avg: f64 = avg_row.get::<Option<f64>, _>("avg_score").unwrap_or(0.0);

    Ok(Json(json!({ "score": avg })))
}

async fn get_group_overall_consistency(
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let avg_row = sqlx::query(
        "SELECT AVG(completion_percentage)::float8 as avg_score FROM heatmap_records WHERE group_id = $1 AND user_id IS NULL",
    )
    .bind(group_id)
    .fetch_one(&state.pool)
    .await?;

    let avg: f64 = avg_row.get::<Option<f64>, _>("avg_score").unwrap_or(0.0);

    Ok(Json(json!({ "score": avg })))
}

async fn get_individual_group_consistency(
    Path((group_id, user_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let avg_row = sqlx::query(
        "SELECT AVG(completion_percentage)::float8 as avg_score FROM heatmap_records WHERE group_id = $1 AND user_id = $2",
    )
    .bind(group_id)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    let avg: f64 = avg_row.get::<Option<f64>, _>("avg_score").unwrap_or(0.0);

    Ok(Json(json!({ "score": avg })))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async fn fetch_tasks_with_lazy_reset(
    pool: &sqlx::PgPool,
    habit_id: i64,
    today: NaiveDate,
) -> Result<Vec<HabitTaskResponse>, AppError> {
    let rows = sqlx::query(
        "SELECT id, habit_id, title, completed, last_completed_date FROM habit_tasks WHERE habit_id = $1 ORDER BY id ASC",
    )
    .bind(habit_id)
    .fetch_all(pool)
    .await?;

    let mut result = Vec::new();
    for r in rows {
        let tid: i64 = r.get("id");
        let hid: i64 = r.get("habit_id");
        let title: String = r.get("title");
        let mut completed: bool = r.get("completed");
        let last_date: Option<NaiveDate> = r.get("last_completed_date");

        if completed {
            if let Some(d) = last_date {
                if d < today {
                    let _ = sqlx::query("UPDATE habit_tasks SET completed = false WHERE id = $1")
                        .bind(tid)
                        .execute(pool)
                        .await;
                    completed = false;
                }
            }
        }
        result.push(HabitTaskResponse {
            id: tid,
            habit_id: hid,
            title,
            completed,
        });
    }

    Ok(result)
}

async fn update_heatmap_record(
    pool: &sqlx::PgPool,
    user_id: i64,
    group_id: Option<i64>,
    date: NaiveDate,
) -> Result<(), AppError> {
    if let Some(gid) = group_id {
        let total_row = sqlx::query("SELECT count(*) as count FROM habits WHERE group_id = $1")
            .bind(gid)
            .fetch_one(pool)
            .await?;
        let total: i64 = total_row.get("count");

        let completed_row = sqlx::query(
            r#"
            SELECT count(DISTINCT c.habit_id) as count
            FROM habit_completions c
            JOIN habits h ON h.id = c.habit_id
            WHERE h.group_id = $1 AND c.completion_date = $2
            "#,
        )
        .bind(gid)
        .bind(date)
        .fetch_one(pool)
        .await?;
        let completed: i64 = completed_row.get("count");

        let pct = if total > 0 { ((completed * 100) / total) as i32 } else { 0 };

        sqlx::query(
            r#"
            INSERT INTO heatmap_records (group_id, record_date, total_tasks, completed_tasks, completion_percentage)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(gid)
        .bind(date)
        .bind(total as i32)
        .bind(completed as i32)
        .bind(pct)
        .execute(pool)
        .await?;
    } else {
        let total_row = sqlx::query("SELECT count(*) as count FROM habits WHERE user_id = $1 AND group_id IS NULL")
            .bind(user_id)
            .fetch_one(pool)
            .await?;
        let total: i64 = total_row.get("count");

        let completed_row = sqlx::query(
            r#"
            SELECT count(DISTINCT c.habit_id) as count
            FROM habit_completions c
            JOIN habits h ON h.id = c.habit_id
            WHERE h.user_id = $1 AND h.group_id IS NULL AND c.completion_date = $2
            "#,
        )
        .bind(user_id)
        .bind(date)
        .fetch_one(pool)
        .await?;
        let completed: i64 = completed_row.get("count");

        let pct = if total > 0 { ((completed * 100) / total) as i32 } else { 0 };

        sqlx::query(
            r#"
            INSERT INTO heatmap_records (user_id, record_date, total_tasks, completed_tasks, completion_percentage)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(user_id)
        .bind(date)
        .bind(total as i32)
        .bind(completed as i32)
        .bind(pct)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn update_streak_snapshots(pool: &sqlx::PgPool, user_id: i64, date: NaiveDate) -> Result<(), AppError> {
    let personal_earned = evaluate_streak_for_date(pool, user_id, None, date).await?;

    let total_row = sqlx::query("SELECT count(*) as count FROM habits WHERE user_id = $1 AND group_id IS NULL")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    let total: i64 = total_row.get("count");

    let completed_row = sqlx::query(
        r#"
        SELECT count(DISTINCT c.habit_id) as count
        FROM habit_completions c
        JOIN habits h ON h.id = c.habit_id
        WHERE h.user_id = $1 AND h.group_id IS NULL AND c.completion_date = $2
        "#,
    )
    .bind(user_id)
    .bind(date)
    .fetch_one(pool)
    .await?;
    let completed: i64 = completed_row.get("count");

    sqlx::query(
        r#"
        INSERT INTO daily_streak_snapshots (user_id, group_id, snapshot_date, streak_earned, total_habits, completed_habits)
        VALUES ($1, NULL, $2, $3, $4, $5)
        "#,
    )
    .bind(user_id)
    .bind(date)
    .bind(personal_earned)
    .bind(total as i32)
    .bind(completed as i32)
    .execute(pool)
    .await?;

    Ok(())
}

async fn evaluate_streak_for_date(
    pool: &sqlx::PgPool,
    user_id: i64,
    group_id: Option<i64>,
    date: NaiveDate,
) -> Result<bool, AppError> {
    let habits = if let Some(gid) = group_id {
        sqlx::query("SELECT id FROM habits WHERE user_id = $1 AND group_id = $2")
            .bind(user_id)
            .bind(gid)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query("SELECT id FROM habits WHERE user_id = $1 AND group_id IS NULL")
            .bind(user_id)
            .fetch_all(pool)
            .await?
    };

    if habits.is_empty() {
        return Ok(false);
    }

    let habit_ids: Vec<i64> = habits.into_iter().map(|h| h.get("id")).collect();
    let completed_row = sqlx::query(
        "SELECT count(DISTINCT habit_id) as count FROM habit_completions WHERE user_id = $1 AND habit_id = ANY($2) AND completion_date = $3",
    )
    .bind(user_id)
    .bind(&habit_ids)
    .bind(date)
    .fetch_one(pool)
    .await?;

    let completed_count: i64 = completed_row.get("count");
    Ok(completed_count >= habit_ids.len() as i64)
}

async fn calculate_streak(pool: &sqlx::PgPool, user_id: i64, group_id: Option<i64>) -> Result<i32, AppError> {
    let today = Utc::now().date_naive();
    let mut streak = 0;

    let today_earned = evaluate_streak_for_date(pool, user_id, group_id, today).await?;
    if today_earned {
        streak += 1;
    }

    let mut check_date = today - Duration::days(1);
    loop {
        let earned = evaluate_streak_for_date(pool, user_id, group_id, check_date).await?;
        if earned {
            streak += 1;
            check_date -= Duration::days(1);
        } else {
            break;
        }
    }

    Ok(streak)
}

async fn calculate_personal_best(pool: &sqlx::PgPool, user_id: i64, group_id: Option<i64>) -> Result<i32, AppError> {
    let current = calculate_streak(pool, user_id, group_id).await?;
    Ok(current.max(1))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/habits", post(create_personal_habit))
        .route("/habits/group", post(create_group_tracking_habit))
        .route("/habits/users/:user_id", get(get_habits_for_user))
        .route("/habits/:id", delete(delete_habit))
        .route("/habits/:id/complete", post(complete_habit))
        .route("/habits/:id/tasks", post(create_task).get(get_tasks))
        .route("/habits/tasks/:id/toggle", patch(toggle_task))
        .route("/habits/tasks/:id", delete(delete_task))
        .route("/habits/consistency/personal", get(get_personal_consistency))
        .route("/habits/groups/:id/consistency/overall", get(get_group_overall_consistency))
        .route("/habits/groups/:group_id/users/:user_id/consistency", get(get_individual_group_consistency))
        .route("/habits/groups/:group_id/heatmap", get(get_group_heatmap))
        .route("/habits/groups/:group_id/users/:user_id/heatmap", get(get_user_group_heatmap))
        .route("/habits/groups/:group_id/users/:user_id/streak", get(get_group_streak))
        .route("/users/:user_id/heatmap", get(get_user_heatmap))
        .route("/users/:user_id/streak", get(get_user_streak))
        .route("/groups/:group_id/users/:user_id/streak", get(get_group_streak))
}
