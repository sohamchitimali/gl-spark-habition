use crate::{
    error::AppError,
    middleware::auth::{AuthUser, OptionalAuthUser},
    models::group::*,
    services::search::{search_groups, sync_group_meilisearch},
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use chrono::{Duration, NaiveDateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

fn generate_invite_code() -> String {
    Uuid::new_v4().to_string().replace('-', "")[..8].to_uppercase()
}

async fn fetch_group_response(pool: &sqlx::PgPool, group_id: i64, user_id: Option<i64>) -> Result<GroupResponse, AppError> {
    let g = sqlx::query(
        r#"
        SELECT id, name, invite_code, owner_id, competition_start_date, competition_end_date,
               competition_active, description, duration, visibility, latitude, longitude,
               address_display, member_count, notifications_enabled, canonical_day_anchor_timezone,
               consistency_score, created_at, current_global_habit_group_streak, highest_habit_group_streak
        FROM habit_groups
        WHERE id = $1
        "#,
    )
    .bind(group_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Group not found".to_string()))?;

    let members = sqlx::query("SELECT user_id, is_admin FROM group_members WHERE group_id = $1")
        .bind(group_id)
        .fetch_all(pool)
        .await?;

    let member_ids: Vec<i64> = members.iter().map(|m| m.get("user_id")).collect();
    let admin_ids: Vec<i64> = members
        .iter()
        .filter(|m| m.get::<Option<bool>, _>("is_admin").unwrap_or(false))
        .map(|m| m.get("user_id"))
        .collect();

    let habit_rows = sqlx::query("SELECT id, title, description FROM group_habits WHERE group_id = $1")
        .bind(group_id)
        .fetch_all(pool)
        .await?;

    let habits = habit_rows
        .into_iter()
        .map(|h| GroupHabitResponse {
            id: h.get("id"),
            title: h.get("title"),
            description: h.get("description"),
        })
        .collect();

    let tag_rows = sqlx::query(
        r#"
        SELECT t.name FROM tags t
        JOIN group_tags gt ON t.id = gt.tag_id
        WHERE gt.group_id = $1
        "#,
    )
    .bind(group_id)
    .fetch_all(pool)
    .await?;

    let tags: Vec<String> = tag_rows.into_iter().map(|t| t.get("name")).collect();

    let pending_count_row = sqlx::query(
        "SELECT count(*) as count FROM group_join_requests WHERE group_id = $1 AND status = 'PENDING'",
    )
    .bind(group_id)
    .fetch_one(pool)
    .await?;
    let pending_count: i64 = pending_count_row.get("count");

    let current_user_requested = if let Some(uid) = user_id {
        let req = sqlx::query(
            "SELECT id FROM group_join_requests WHERE group_id = $1 AND applicant_id = $2 AND status = 'PENDING'",
        )
        .bind(group_id)
        .bind(uid)
        .fetch_optional(pool)
        .await?;
        req.is_some()
    } else {
        false
    };

    let mem_count: Option<i32> = g.get("member_count");
    let created_at: NaiveDateTime = g.get("created_at");

    Ok(GroupResponse {
        id: g.get("id"),
        name: g.get("name"),
        invite_code: g.get("invite_code"),
        owner_id: g.get("owner_id"),
        member_ids: member_ids.clone(),
        admin_ids,
        habits,
        description: g.get("description"),
        duration: g.get("duration"),
        competition_end_date: g.get("competition_end_date"),
        visibility: g.get("visibility"),
        has_pending_requests: Some(pending_count > 0),
        current_user_requested: Some(current_user_requested),
        latitude: g.get("latitude"),
        longitude: g.get("longitude"),
        address_display: g.get("address_display"),
        tags,
        consistency_score: g.get("consistency_score"),
        current_global_habit_group_streak: g.get("current_global_habit_group_streak"),
        highest_habit_group_streak: g.get("highest_habit_group_streak"),
        created_at: Some(created_at),
        member_count: Some(mem_count.unwrap_or(member_ids.len() as i32)),
        notifications_enabled: Some(g.get("notifications_enabled")),
    })
}

async fn create_group(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateGroupRequest>,
) -> Result<(StatusCode, Json<GroupResponse>), AppError> {
    let invite_code = generate_invite_code();
    let visibility = payload.visibility.unwrap_or_else(|| "INVITE_ONLY".to_string());
    let notifications_enabled = payload.notifications_enabled.unwrap_or(true);

    let years = payload.years.unwrap_or(0);
    let months = payload.months.unwrap_or(0);
    let weeks = payload.weeks.unwrap_or(0);
    let days = payload.days.unwrap_or(0);

    let (competition_active, competition_end_date, duration) = if years > 0 || months > 0 || weeks > 0 || days > 0 {
        let mut end = Utc::now().naive_utc();
        end += Duration::days((years * 365 + months * 30 + weeks * 7 + days) as i64);
        (true, Some(end), Some(format!("{}y {}m {}w {}d", years, months, weeks, days)))
    } else {
        (false, None, Some("Indefinite".to_string()))
    };

    let group_row = sqlx::query(
        r#"
        INSERT INTO habit_groups (
            name, invite_code, owner_id, competition_start_date, competition_end_date,
            competition_active, description, duration, visibility, latitude, longitude,
            address_display, member_count, notifications_enabled
        )
        VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, 1, $12)
        RETURNING id
        "#,
    )
    .bind(&payload.name)
    .bind(&invite_code)
    .bind(auth.0)
    .bind(competition_end_date)
    .bind(competition_active)
    .bind(&payload.description)
    .bind(&duration)
    .bind(&visibility)
    .bind(payload.latitude)
    .bind(payload.longitude)
    .bind(&payload.address_display)
    .bind(notifications_enabled)
    .fetch_one(&state.pool)
    .await?;

    let group_id: i64 = group_row.get("id");

    sqlx::query("INSERT INTO group_members (group_id, user_id, is_admin) VALUES ($1, $2, true)")
        .bind(group_id)
        .bind(auth.0)
        .execute(&state.pool)
        .await?;

    if let Some(friends) = payload.invite_friend_ids {
        for friend_id in friends {
            if friend_id != auth.0 {
                let _ = sqlx::query(
                    "INSERT INTO group_members (group_id, user_id, is_admin) VALUES ($1, $2, false) ON CONFLICT DO NOTHING",
                )
                .bind(group_id)
                .bind(friend_id)
                .execute(&state.pool)
                .await;
            }
        }
    }

    if let Some(tags) = &payload.tags {
        for tag_str in tags {
            let clean_tag = tag_str.trim().to_lowercase();
            if clean_tag.is_empty() { continue; }

            let tag_id: i64 = match sqlx::query("SELECT id FROM tags WHERE name = $1")
                .bind(&clean_tag)
                .fetch_optional(&state.pool)
                .await?
            {
                Some(t) => t.get("id"),
                None => {
                    let _ = sqlx::query("INSERT INTO tags (name) VALUES ($1) ON CONFLICT DO NOTHING")
                        .bind(&clean_tag)
                        .execute(&state.pool)
                        .await;
                    let t = sqlx::query("SELECT id FROM tags WHERE name = $1")
                        .bind(&clean_tag)
                        .fetch_one(&state.pool)
                        .await?;
                    t.get("id")
                }
            };

            let _ = sqlx::query(
                "INSERT INTO group_tags (group_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(group_id)
            .bind(tag_id)
            .execute(&state.pool)
            .await;
        }
    }

    let tags_vec = payload.tags.unwrap_or_default();
    sync_group_meilisearch(
        &state.config,
        &state.http_client,
        group_id,
        &payload.name,
        payload.description.as_deref().unwrap_or(""),
        &tags_vec,
        &visibility,
    )
    .await;

    let res = fetch_group_response(&state.pool, group_id, Some(auth.0)).await?;
    Ok((StatusCode::CREATED, Json(res)))
}

async fn join_group(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<JoinGroupRequest>,
) -> Result<Json<GroupResponse>, AppError> {
    let group = sqlx::query("SELECT id, member_count FROM habit_groups WHERE invite_code = $1")
        .bind(payload.invite_code.trim().to_uppercase())
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Invalid invite code".to_string()))?;

    let group_id: i64 = group.get("id");

    let blocked = sqlx::query("SELECT id FROM group_blocks WHERE group_id = $1 AND blocked_user_id = $2")
        .bind(group_id)
        .bind(auth.0)
        .fetch_optional(&state.pool)
        .await?;
    if blocked.is_some() {
        return Err(AppError::Forbidden("You are blocked from joining this group".to_string()));
    }

    let existing = sqlx::query("SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2")
        .bind(group_id)
        .bind(auth.0)
        .fetch_optional(&state.pool)
        .await?;

    if existing.is_some() {
        return Err(AppError::Conflict("Already a member of this group".to_string()));
    }

    sqlx::query("INSERT INTO group_members (group_id, user_id, is_admin) VALUES ($1, $2, false)")
        .bind(group_id)
        .bind(auth.0)
        .execute(&state.pool)
        .await?;

    sqlx::query("UPDATE habit_groups SET member_count = member_count + 1 WHERE id = $1")
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    let res = fetch_group_response(&state.pool, group_id, Some(auth.0)).await?;
    Ok(Json(res))
}

async fn get_group(
    opt_auth: OptionalAuthUser,
    Path(id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<GroupResponse>, AppError> {
    let res = fetch_group_response(&state.pool, id, opt_auth.0).await?;
    Ok(Json(res))
}

async fn get_my_groups(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<GroupResponse>>, AppError> {
    let member_rows = sqlx::query("SELECT group_id FROM group_members WHERE user_id = $1")
        .bind(auth.0)
        .fetch_all(&state.pool)
        .await?;

    let mut result = Vec::new();
    for row in member_rows {
        let gid: i64 = row.get("group_id");
        if let Ok(g) = fetch_group_response(&state.pool, gid, Some(auth.0)).await {
            result.push(g);
        }
    }

    Ok(Json(result))
}

async fn search_groups_route(
    opt_auth: OptionalAuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SearchGroupRequest>,
) -> Result<Json<Vec<GroupResponse>>, AppError> {
    let user_tags = payload.user_tags.unwrap_or_default();

    let mut groups = search_groups(
        &state.pool,
        &state.config,
        &state.http_client,
        &payload.query,
        &user_tags,
        payload.user_lat,
        payload.user_lng,
    )
    .await;

    if let Some(user_id) = opt_auth.0 {
        groups.retain(|g| !g.member_ids.contains(&user_id));
        for g in &mut groups {
            let req = sqlx::query(
                "SELECT id FROM group_join_requests WHERE group_id = $1 AND applicant_id = $2 AND status = 'PENDING'",
            )
            .bind(g.id)
            .bind(user_id)
            .fetch_optional(&state.pool)
            .await
            .unwrap_or(None);
            g.current_user_requested = Some(req.is_some());
        }
    }

    Ok(Json(groups))
}

async fn add_habit(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
    Json(payload): Json<AddHabitRequest>,
) -> Result<(StatusCode, Json<GroupHabitResponse>), AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let row = sqlx::query(
        "INSERT INTO group_habits (group_id, title, description) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(group_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .fetch_one(&state.pool)
    .await?;

    let hid: i64 = row.get("id");

    Ok((
        StatusCode::CREATED,
        Json(GroupHabitResponse {
            id: hid,
            title: payload.title,
            description: payload.description,
        }),
    ))
}

async fn delete_habit(
    auth: AuthUser,
    Path((group_id, habit_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    sqlx::query("DELETE FROM group_habits WHERE id = $1 AND group_id = $2")
        .bind(habit_id)
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn change_deadline(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
    Json(payload): Json<ChangeDeadlineRequest>,
) -> Result<Json<GroupResponse>, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let current = sqlx::query("SELECT competition_end_date FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(&state.pool)
        .await?;

    let comp_end: Option<NaiveDateTime> = current.get("competition_end_date");

    let new_end = match payload.mode.as_str() {
        "SET" => payload.new_date.unwrap_or_else(|| Utc::now().naive_utc()),
        "ADD" => {
            let base = comp_end.unwrap_or_else(|| Utc::now().naive_utc());
            base + Duration::days(
                (payload.years.unwrap_or(0) * 365
                    + payload.months.unwrap_or(0) * 30
                    + payload.weeks.unwrap_or(0) * 7
                    + payload.days.unwrap_or(0)) as i64,
            )
        }
        "REDUCE" => {
            let base = comp_end.unwrap_or_else(|| Utc::now().naive_utc());
            base - Duration::days(
                (payload.years.unwrap_or(0) * 365
                    + payload.months.unwrap_or(0) * 30
                    + payload.weeks.unwrap_or(0) * 7
                    + payload.days.unwrap_or(0)) as i64,
            )
        }
        _ => return Err(AppError::BadRequest("Invalid deadline mode".to_string())),
    };

    sqlx::query("UPDATE habit_groups SET competition_end_date = $1, competition_active = true WHERE id = $2")
        .bind(new_end)
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    let res = fetch_group_response(&state.pool, group_id, Some(auth.0)).await?;
    Ok(Json(res))
}

async fn update_settings(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateGroupSettingsRequest>,
) -> Result<Json<GroupResponse>, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let group = sqlx::query("SELECT owner_id, notifications_enabled FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(&state.pool)
        .await?;

    let owner_id: i64 = group.get("owner_id");
    let curr_notif: bool = group.get("notifications_enabled");

    let notif_enabled = if let Some(ne) = payload.notifications_enabled {
        if owner_id != auth.0 {
            return Err(AppError::Forbidden("Only the owner can toggle notifications".to_string()));
        }
        ne
    } else {
        curr_notif
    };

    sqlx::query(
        r#"
        UPDATE habit_groups SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            latitude = COALESCE($3, latitude),
            longitude = COALESCE($4, longitude),
            address_display = COALESCE($5, address_display),
            notifications_enabled = $6
        WHERE id = $7
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(payload.latitude)
    .bind(payload.longitude)
    .bind(&payload.address_display)
    .bind(notif_enabled)
    .bind(group_id)
    .execute(&state.pool)
    .await?;

    if let Some(tags) = payload.tags {
        sqlx::query("DELETE FROM group_tags WHERE group_id = $1")
            .bind(group_id)
            .execute(&state.pool)
            .await?;

        for tag_str in tags {
            let clean_tag = tag_str.trim().to_lowercase();
            if clean_tag.is_empty() { continue; }

            let tag_id: i64 = match sqlx::query("SELECT id FROM tags WHERE name = $1")
                .bind(&clean_tag)
                .fetch_optional(&state.pool)
                .await?
            {
                Some(t) => t.get("id"),
                None => {
                    let _ = sqlx::query("INSERT INTO tags (name) VALUES ($1) ON CONFLICT DO NOTHING")
                        .bind(&clean_tag)
                        .execute(&state.pool)
                        .await;
                    let t = sqlx::query("SELECT id FROM tags WHERE name = $1")
                        .bind(&clean_tag)
                        .fetch_one(&state.pool)
                        .await?;
                    t.get("id")
                }
            };

            let _ = sqlx::query(
                "INSERT INTO group_tags (group_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(group_id)
            .bind(tag_id)
            .execute(&state.pool)
            .await;
        }
    }

    let res = fetch_group_response(&state.pool, group_id, Some(auth.0)).await?;
    Ok(Json(res))
}

async fn promote_admin(
    auth: AuthUser,
    Path((group_id, target_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<Json<GroupResponse>, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let rows_affected = sqlx::query(
        "UPDATE group_members SET is_admin = true WHERE group_id = $1 AND user_id = $2",
    )
    .bind(group_id)
    .bind(target_id)
    .execute(&state.pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound("Target user is not a member".to_string()));
    }

    let res = fetch_group_response(&state.pool, group_id, Some(auth.0)).await?;
    Ok(Json(res))
}

async fn demote_admin(
    auth: AuthUser,
    Path((group_id, target_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<Json<GroupResponse>, AppError> {
    let group = sqlx::query("SELECT owner_id FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(&state.pool)
        .await?;

    let owner_id: i64 = group.get("owner_id");
    if owner_id != auth.0 {
        return Err(AppError::Forbidden("Only owner can demote admins".to_string()));
    }

    sqlx::query(
        "UPDATE group_members SET is_admin = false WHERE group_id = $1 AND user_id = $2",
    )
    .bind(group_id)
    .bind(target_id)
    .execute(&state.pool)
    .await?;

    let res = fetch_group_response(&state.pool, group_id, Some(auth.0)).await?;
    Ok(Json(res))
}

async fn kick_member(
    auth: AuthUser,
    Path((group_id, target_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    process_kick(&state.pool, group_id, target_id, auth.0, false).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn kick_and_block_member(
    auth: AuthUser,
    Path((group_id, target_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    process_kick(&state.pool, group_id, target_id, auth.0, true).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn process_kick(
    pool: &sqlx::PgPool,
    group_id: i64,
    target_id: i64,
    acting_id: i64,
    block: bool,
) -> Result<(), AppError> {
    let group = sqlx::query("SELECT owner_id FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(pool)
        .await?;

    let owner_id: i64 = group.get("owner_id");
    if owner_id == target_id {
        return Err(AppError::BadRequest("Cannot kick the owner of the group".to_string()));
    }

    validate_admin(pool, group_id, acting_id).await?;

    let target_member = sqlx::query("SELECT is_admin FROM group_members WHERE group_id = $1 AND user_id = $2")
        .bind(group_id)
        .bind(target_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Target is not a member".to_string()))?;

    let is_admin: Option<bool> = target_member.get("is_admin");
    if is_admin.unwrap_or(false) && owner_id != acting_id {
        return Err(AppError::Forbidden("Only the owner can kick admins".to_string()));
    }

    sqlx::query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2")
        .bind(group_id)
        .bind(target_id)
        .execute(pool)
        .await?;

    sqlx::query("UPDATE habit_groups SET member_count = GREATEST(0, member_count - 1) WHERE id = $1")
        .bind(group_id)
        .execute(pool)
        .await?;

    if block {
        sqlx::query(
            r#"
            INSERT INTO group_blocks (group_id, blocked_user_id, blocked_by_user_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (group_id, blocked_user_id) DO NOTHING
            "#,
        )
        .bind(group_id)
        .bind(target_id)
        .bind(acting_id)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn delete_group(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let group = sqlx::query("SELECT owner_id FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(&state.pool)
        .await?;

    let owner_id: i64 = group.get("owner_id");
    if owner_id != auth.0 {
        return Err(AppError::Forbidden("Only the owner can delete the group".to_string()));
    }

    sqlx::query("DELETE FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn leave_group(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    let group = sqlx::query("SELECT owner_id FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(&state.pool)
        .await?;

    let owner_id: i64 = group.get("owner_id");
    if owner_id == auth.0 {
        return Err(AppError::BadRequest("Owner cannot leave the group. Delete it instead.".to_string()));
    }

    let rows_affected = sqlx::query("DELETE FROM group_members WHERE group_id = $1 AND user_id = $2")
        .bind(group_id)
        .bind(auth.0)
        .execute(&state.pool)
        .await?
        .rows_affected();

    if rows_affected > 0 {
        sqlx::query("UPDATE habit_groups SET member_count = GREATEST(0, member_count - 1) WHERE id = $1")
            .bind(group_id)
            .execute(&state.pool)
            .await?;
    }

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct ToggleNotificationsQuery {
    pub enabled: bool,
}

async fn toggle_notifications(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    Query(query): Query<ToggleNotificationsQuery>,
    State(state): State<AppState>,
) -> Result<Json<GroupResponse>, AppError> {

    let group_row = sqlx::query("SELECT owner_id FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(&state.pool)
        .await?;

    let owner_id: i64 = group_row.get("owner_id");
    if owner_id != auth.0 {
        return Err(AppError::Forbidden("Only the owner can toggle notifications".to_string()));
    }

    sqlx::query("UPDATE habit_groups SET notifications_enabled = $1 WHERE id = $2")
        .bind(query.enabled)
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    let res = fetch_group_response(&state.pool, group_id, Some(auth.0)).await?;
    Ok(Json(res))
}

// ─── Join Requests ───────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RequestToJoinPayload {
    pub initial_message: Option<String>,
}

async fn request_to_join(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
    Json(payload): Json<RequestToJoinPayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let group = sqlx::query("SELECT id, visibility FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Group not found".to_string()))?;

    let visibility: Option<String> = group.get("visibility");

    let is_member = sqlx::query("SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2")
        .bind(group_id)
        .bind(auth.0)
        .fetch_optional(&state.pool)
        .await?;

    if is_member.is_some() {
        return Err(AppError::Conflict("Already a member".to_string()));
    }

    if visibility.as_deref() == Some("PUBLIC") {
        sqlx::query("INSERT INTO group_members (group_id, user_id, is_admin) VALUES ($1, $2, false) ON CONFLICT DO NOTHING")
            .bind(group_id)
            .bind(auth.0)
            .execute(&state.pool)
            .await?;

        sqlx::query("UPDATE habit_groups SET member_count = member_count + 1 WHERE id = $1")
            .bind(group_id)
            .execute(&state.pool)
            .await?;

        let row = sqlx::query(
            r#"
            INSERT INTO group_join_requests (group_id, applicant_id, status, initial_message)
            VALUES ($1, $2, 'APPROVED', 'Auto-approved for PUBLIC group')
            RETURNING id
            "#,
        )
        .bind(group_id)
        .bind(auth.0)
        .fetch_one(&state.pool)
        .await?;

        let rid: i64 = row.get("id");
        return Ok((StatusCode::CREATED, Json(json!({ "id": rid, "status": "APPROVED" }))));
    }

    let row = sqlx::query(
        r#"
        INSERT INTO group_join_requests (group_id, applicant_id, status, initial_message)
        VALUES ($1, $2, 'PENDING', $3)
        RETURNING id
        "#,
    )
    .bind(group_id)
    .bind(auth.0)
    .bind(&payload.initial_message)
    .fetch_one(&state.pool)
    .await?;

    let rid: i64 = row.get("id");
    Ok((StatusCode::CREATED, Json(json!({ "id": rid, "status": "PENDING" }))))
}

async fn get_pending_requests(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let rows = sqlx::query(
        r#"
        SELECT r.id, r.group_id, r.applicant_id, r.status, r.initial_message, r.created_at,
               u.username as applicant_username, up.name as applicant_name
        FROM group_join_requests r
        JOIN users u ON u.id = r.applicant_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE r.group_id = $1 AND r.status = 'PENDING'
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(group_id)
    .fetch_all(&state.pool)
    .await?;

    let list = rows
        .into_iter()
        .map(|r| {
            let rid: i64 = r.get("id");
            let gid: i64 = r.get("group_id");
            let aid: i64 = r.get("applicant_id");
            let status: String = r.get("status");
            let msg: Option<String> = r.get("initial_message");
            let cat: NaiveDateTime = r.get("created_at");
            let uname: Option<String> = r.get("applicant_username");
            let name: Option<String> = r.get("applicant_name");
            json!({
                "id": rid,
                "groupId": gid,
                "applicantId": aid,
                "status": status,
                "initialMessage": msg,
                "createdAt": cat,
                "applicantUsername": uname,
                "applicantName": name,
            })
        })
        .collect();

    Ok(Json(list))
}

async fn approve_request(
    auth: AuthUser,
    Path((group_id, request_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let req = sqlx::query("SELECT applicant_id FROM group_join_requests WHERE id = $1 AND group_id = $2")
        .bind(request_id)
        .bind(group_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Request not found".to_string()))?;

    let applicant_id: i64 = req.get("applicant_id");

    sqlx::query("UPDATE group_join_requests SET status = 'APPROVED', updated_at = NOW() WHERE id = $1")
        .bind(request_id)
        .execute(&state.pool)
        .await?;

    sqlx::query("INSERT INTO group_members (group_id, user_id, is_admin) VALUES ($1, $2, false) ON CONFLICT DO NOTHING")
        .bind(group_id)
        .bind(applicant_id)
        .execute(&state.pool)
        .await?;

    sqlx::query("UPDATE habit_groups SET member_count = member_count + 1 WHERE id = $1")
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::OK)
}

async fn reject_request(
    auth: AuthUser,
    Path((group_id, request_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    sqlx::query("UPDATE group_join_requests SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 AND group_id = $2")
        .bind(request_id)
        .bind(group_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::OK)
}

async fn get_my_sent_requests(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<SentJoinRequestResponse>>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT r.id, r.group_id, r.applicant_id, r.status, r.initial_message, r.created_at, r.updated_at,
               g.name as group_name, g.description as group_description
        FROM group_join_requests r
        JOIN habit_groups g ON g.id = r.group_id
        WHERE r.applicant_id = $1
        ORDER BY r.created_at DESC
        "#,
    )
    .bind(auth.0)
    .fetch_all(&state.pool)
    .await?;

    let list = rows
        .into_iter()
        .map(|r| SentJoinRequestResponse {
            id: r.get("id"),
            group_id: r.get("group_id"),
            group_name: r.get("group_name"),
            group_description: r.get("group_description"),
            group_tags: None,
            applicant_id: r.get("applicant_id"),
            status: r.get("status"),
            initial_message: r.get("initial_message"),
            created_at: Some(r.get("created_at")),
            updated_at: Some(r.get("updated_at")),
        })
        .collect();

    Ok(Json(list))
}

#[derive(Debug, Deserialize)]
pub struct SendJoinMessagePayload {
    pub content: String,
}

async fn send_join_message(
    auth: AuthUser,
    Path((group_id, request_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
    Json(payload): Json<SendJoinMessagePayload>,
) -> Result<(StatusCode, Json<serde_json::Value>), AppError> {
    let req = sqlx::query("SELECT applicant_id FROM group_join_requests WHERE id = $1 AND group_id = $2")
        .bind(request_id)
        .bind(group_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Request not found".to_string()))?;

    let applicant_id: i64 = req.get("applicant_id");

    let group = sqlx::query("SELECT owner_id FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_one(&state.pool)
        .await?;

    let owner_id: i64 = group.get("owner_id");
    let receiver_id = if auth.0 == applicant_id { owner_id } else { applicant_id };

    let dm = sqlx::query(
        r#"
        INSERT INTO direct_messages (sender_id, receiver_id, group_id, chat_type, content)
        VALUES ($1, $2, $3, 'JOIN_REQUEST', $4)
        RETURNING id, created_at
        "#,
    )
    .bind(auth.0)
    .bind(receiver_id)
    .bind(group_id)
    .bind(&payload.content)
    .fetch_one(&state.pool)
    .await?;

    let mid: i64 = dm.get("id");
    let created_at: NaiveDateTime = dm.get("created_at");

    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": mid,
            "senderId": auth.0,
            "receiverId": receiver_id,
            "groupId": group_id,
            "content": payload.content,
            "chatType": "JOIN_REQUEST",
            "createdAt": created_at
        })),
    ))
}

async fn get_join_messages(
    Path((group_id, request_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    let req = sqlx::query("SELECT applicant_id FROM group_join_requests WHERE id = $1 AND group_id = $2")
        .bind(request_id)
        .bind(group_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Request not found".to_string()))?;

    let applicant_id: i64 = req.get("applicant_id");

    let messages = sqlx::query(
        r#"
        SELECT id, sender_id, receiver_id, group_id, content, chat_type, is_read, created_at
        FROM direct_messages
        WHERE group_id = $1 AND (sender_id = $2 OR receiver_id = $2)
        ORDER BY created_at ASC
        "#,
    )
    .bind(group_id)
    .bind(applicant_id)
    .fetch_all(&state.pool)
    .await?;

    let list = messages
        .into_iter()
        .map(|m| {
            let mid: i64 = m.get("id");
            let sid: i64 = m.get("sender_id");
            let rid: Option<i64> = m.get("receiver_id");
            let gid: Option<i64> = m.get("group_id");
            let content: String = m.get("content");
            let chat_type: String = m.get("chat_type");
            let is_read: bool = m.get("is_read");
            let created_at: NaiveDateTime = m.get("created_at");
            json!({
                "id": mid,
                "senderId": sid,
                "receiverId": rid,
                "groupId": gid,
                "content": content,
                "chatType": chat_type,
                "isRead": is_read,
                "createdAt": created_at
            })
        })
        .collect();

    Ok(Json(list))
}

async fn block_requester(
    auth: AuthUser,
    Path((group_id, request_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let req = sqlx::query("SELECT applicant_id FROM group_join_requests WHERE id = $1 AND group_id = $2")
        .bind(request_id)
        .bind(group_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Request not found".to_string()))?;

    let applicant_id: i64 = req.get("applicant_id");

    sqlx::query("UPDATE group_join_requests SET status = 'REJECTED' WHERE id = $1")
        .bind(request_id)
        .execute(&state.pool)
        .await?;

    sqlx::query(
        r#"
        INSERT INTO group_blocks (group_id, blocked_user_id, blocked_by_user_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (group_id, blocked_user_id) DO NOTHING
        "#,
    )
    .bind(group_id)
    .bind(applicant_id)
    .bind(auth.0)
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::OK)
}

async fn get_blocked_users(
    auth: AuthUser,
    Path(group_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    let rows = sqlx::query(
        r#"
        SELECT b.id, b.blocked_user_id, b.blocked_at, u.username, up.name
        FROM group_blocks b
        JOIN users u ON u.id = b.blocked_user_id
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE b.group_id = $1
        ORDER BY b.blocked_at DESC
        "#,
    )
    .bind(group_id)
    .fetch_all(&state.pool)
    .await?;

    let list = rows
        .into_iter()
        .map(|r| {
            let bid: i64 = r.get("id");
            let buid: i64 = r.get("blocked_user_id");
            let bat: NaiveDateTime = r.get("blocked_at");
            let uname: Option<String> = r.get("username");
            let name: Option<String> = r.get("name");
            json!({
                "id": bid,
                "userId": buid,
                "username": uname,
                "name": name,
                "blockedAt": bat
            })
        })
        .collect();

    Ok(Json(list))
}

async fn unblock_user(
    auth: AuthUser,
    Path((group_id, target_user_id)): Path<(i64, i64)>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    validate_admin(&state.pool, group_id, auth.0).await?;

    sqlx::query("DELETE FROM group_blocks WHERE group_id = $1 AND blocked_user_id = $2")
        .bind(group_id)
        .bind(target_user_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::OK)
}

// ─── Helper ──────────────────────────────────────────────────────────────────

async fn validate_admin(pool: &sqlx::PgPool, group_id: i64, user_id: i64) -> Result<(), AppError> {
    let group = sqlx::query("SELECT owner_id FROM habit_groups WHERE id = $1")
        .bind(group_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Group not found".to_string()))?;

    let owner_id: i64 = group.get("owner_id");
    if owner_id == user_id {
        return Ok(());
    }

    let member = sqlx::query("SELECT is_admin FROM group_members WHERE group_id = $1 AND user_id = $2")
        .bind(group_id)
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::Forbidden("You are not a member of this group".to_string()))?;

    let is_admin: Option<bool> = member.get("is_admin");
    if is_admin.unwrap_or(false) {
        Ok(())
    } else {
        Err(AppError::Forbidden("Admin privileges required".to_string()))
    }
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_group))
        .route("/join", post(join_group))
        .route("/my-groups", get(get_my_groups))
        .route("/my-requests", get(get_my_sent_requests))
        .route("/search", post(search_groups_route))
        .route("/:id", get(get_group).delete(delete_group))
        .route("/:id/habits", post(add_habit))
        .route("/:id/habits/:habit_id", delete(delete_habit))
        .route("/:id/deadline", post(change_deadline))
        .route("/:id/settings", put(update_settings))
        .route("/:id/members/:target_id/promote", post(promote_admin))
        .route("/:id/members/:target_id/demote", post(demote_admin))
        .route("/:id/members/:target_id/kick", delete(kick_member))
        .route("/:id/members/:target_id/kickAndBlock", delete(kick_and_block_member))
        .route("/:id/members/leave", delete(leave_group))
        .route("/:id/notifications", patch(toggle_notifications))
        // Join requests
        .route("/:id/join-requests", post(request_to_join).get(get_pending_requests))
        .route("/:id/join-requests/:req_id/approve", post(approve_request))
        .route("/:id/join-requests/:req_id/reject", post(reject_request))
        .route("/:id/join-requests/:req_id/messages", post(send_join_message).get(get_join_messages))
        .route("/:id/join-requests/:req_id/block", post(block_requester))
        .route("/:id/join-requests/blocked-users", get(get_blocked_users))
        .route("/:id/join-requests/unblock/:target_id", post(unblock_user))
}
