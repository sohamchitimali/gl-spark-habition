use crate::{
    error::AppError,
    middleware::auth::AuthUser,
    models::auth::*,
    services::{
        email::send_email,
        search::{search_users, sync_user_meilisearch},
    },
    state::AppState,
    utils::jwt::{generate_access_token, generate_refresh_token},
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{DateTime, NaiveDateTime, Utc};
use rand::Rng;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct UsernameQuery {
    pub username: String,
    #[allow(dead_code)]
    pub session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UsersQuery {
    pub ids: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub query: String,
}

static OTP_STORE: std::sync::LazyLock<
    std::sync::Mutex<HashMap<String, (String, std::time::Instant)>>,
> = std::sync::LazyLock::new(|| std::sync::Mutex::new(HashMap::new()));

async fn register(
    State(state): State<AppState>,
    Json(payload): Json<AuthRequestDto>,
) -> Result<Json<AuthResponseDto>, AppError> {
    if payload.email.trim().is_empty() {
        return Err(AppError::BadRequest("Email is required".to_string()));
    }

    let username = match &payload.username {
        Some(u) if u.len() >= 5 => u.trim().to_string(),
        _ => return Err(AppError::BadRequest("Username must be at least 5 characters".to_string())),
    };

    let existing_email = sqlx::query("SELECT id FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.pool)
        .await?;
    if existing_email.is_some() {
        return Err(AppError::Conflict("Email already exists".to_string()));
    }

    let existing_username = sqlx::query("SELECT id FROM users WHERE username = $1")
        .bind(&username)
        .fetch_optional(&state.pool)
        .await?;
    if existing_username.is_some() {
        return Err(AppError::Conflict("Username already exists".to_string()));
    }

    let password_hash = hash(&payload.password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let refresh_token = generate_refresh_token();

    let user_row = sqlx::query(
        r#"
        INSERT INTO users (email, password_hash, refresh_token, username)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#,
    )
    .bind(&payload.email)
    .bind(password_hash)
    .bind(&refresh_token)
    .bind(&username)
    .fetch_one(&state.pool)
    .await?;

    let user_id: i64 = user_row.get("id");
    let default_name = payload.email.split('@').next().unwrap_or("User");

    sqlx::query(
        r#"
        INSERT INTO user_profiles (user_id, name, preferred_color)
        VALUES ($1, $2, '#534AB7')
        "#,
    )
    .bind(user_id)
    .bind(default_name)
    .execute(&state.pool)
    .await?;

    let access_token = generate_access_token(user_id, &state.config.jwt_secret)?;

    sync_user_meilisearch(&state.config, &state.http_client, user_id, &username, default_name, &[]).await;

    Ok(Json(AuthResponseDto {
        access_token,
        refresh_token,
        user_id,
    }))
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<AuthRequestDto>,
) -> Result<Json<AuthResponseDto>, AppError> {
    let identifier = payload.email.trim();

    let user_row = if identifier.contains('@') {
        sqlx::query("SELECT id, password_hash FROM users WHERE email = $1")
            .bind(identifier)
            .fetch_optional(&state.pool)
            .await?
    } else {
        sqlx::query("SELECT id, password_hash FROM users WHERE username = $1")
            .bind(identifier)
            .fetch_optional(&state.pool)
            .await?
    };

    let user = user_row.ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;
    let user_id: i64 = user.get("id");
    let password_hash: String = user.get("password_hash");

    let valid = verify(&payload.password, &password_hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    if !valid {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    let refresh_token = generate_refresh_token();
    sqlx::query("UPDATE users SET refresh_token = $1 WHERE id = $2")
        .bind(&refresh_token)
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    let access_token = generate_access_token(user_id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponseDto {
        access_token,
        refresh_token,
        user_id,
    }))
}

async fn refresh(
    State(state): State<AppState>,
    Json(payload): Json<RefreshRequestDto>,
) -> Result<Json<AuthResponseDto>, AppError> {
    let user_row = sqlx::query("SELECT id FROM users WHERE refresh_token = $1")
        .bind(&payload.refresh_token)
        .fetch_optional(&state.pool)
        .await?;

    let user = user_row.ok_or_else(|| AppError::Unauthorized("Invalid refresh token".to_string()))?;
    let user_id: i64 = user.get("id");

    let new_refresh_token = generate_refresh_token();
    sqlx::query("UPDATE users SET refresh_token = $1 WHERE id = $2")
        .bind(&new_refresh_token)
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    let access_token = generate_access_token(user_id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponseDto {
        access_token,
        refresh_token: new_refresh_token,
        user_id,
    }))
}

async fn check_username(
    State(state): State<AppState>,
    Query(query): Query<UsernameQuery>,
) -> Result<Json<bool>, AppError> {
    let existing = sqlx::query("SELECT id FROM users WHERE username = $1")
        .bind(&query.username)
        .fetch_optional(&state.pool)
        .await?;

    Ok(Json(existing.is_none()))
}

async fn get_users_by_ids(
    State(state): State<AppState>,
    Query(query): Query<UsersQuery>,
) -> Result<Json<Vec<UserProfileDto>>, AppError> {
    let id_list: Vec<i64> = match query.ids {
        Some(s) => s
            .split(',')
            .filter_map(|p| p.trim().parse::<i64>().ok())
            .collect(),
        None => Vec::new(),
    };

    if id_list.is_empty() {
        return Ok(Json(Vec::new()));
    }

    let rows = sqlx::query(
        r#"
        SELECT u.id, u.email, u.username, up.name, up.preferred_color, up.address_display, up.bio
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id = ANY($1)
        "#,
    )
    .bind(&id_list)
    .fetch_all(&state.pool)
    .await?;

    let result = rows
        .into_iter()
        .map(|r| UserProfileDto {
            id: r.get("id"),
            email: r.get("email"),
            username: r.get("username"),
            name: r.get("name"),
            user_theme: r.get("preferred_color"),
            address_display: r.get("address_display"),
            bio: r.get("bio"),
        })
        .collect();

    Ok(Json(result))
}

async fn get_user_by_username(
    State(state): State<AppState>,
    Query(query): Query<UsernameQuery>,
) -> Result<Json<UserProfileDto>, AppError> {
    let row = sqlx::query(
        r#"
        SELECT u.id, u.email, u.username, up.name, up.preferred_color, up.address_display, up.bio
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.username = $1
        "#,
    )
    .bind(&query.username)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserProfileDto {
        id: row.get("id"),
        email: row.get("email"),
        username: row.get("username"),
        name: row.get("name"),
        user_theme: row.get("preferred_color"),
        address_display: row.get("address_display"),
        bio: row.get("bio"),
    }))
}

async fn get_profile(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<ProfileDto>, AppError> {
    let row = sqlx::query(
        r#"
        SELECT u.username, up.name, up.preferred_color, up.address_display,
               up.latitude, up.longitude, up.bio, up.time_zone, up.location_visibility, up.auto_timezone
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id = $1
        "#,
    )
    .bind(auth.0)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let tag_rows = sqlx::query(
        r#"
        SELECT t.name FROM tags t
        JOIN user_profile_tags upt ON t.id = upt.tag_id
        JOIN user_profiles up ON upt.user_profile_id = up.id
        WHERE up.user_id = $1
        "#,
    )
    .bind(auth.0)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let tags: Vec<String> = tag_rows.into_iter().map(|t| t.get("name")).collect();
    let addr: Option<String> = row.get("address_display");

    Ok(Json(ProfileDto {
        username: row.get("username"),
        name: row.get("name"),
        user_theme: None,
        preferred_color: row.get("preferred_color"),
        address_display: addr.clone(),
        location: addr,
        latitude: row.get("latitude"),
        longitude: row.get("longitude"),
        bio: row.get("bio"),
        time_zone: row.get("time_zone"),
        experience: None,
        schedule: None,
        location_visibility: row.get("location_visibility"),
        tags: Some(tags),
        auto_timezone: row.get("auto_timezone"),
    }))
}

async fn update_profile(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<ProfileDto>,
) -> Result<Json<ProfileDto>, AppError> {
    if let Some(new_username) = &payload.username {
        let current_user = sqlx::query("SELECT username FROM users WHERE id = $1")
            .bind(auth.0)
            .fetch_one(&state.pool)
            .await?;

        let curr_uname: Option<String> = current_user.get("username");
        if curr_uname.as_deref() != Some(new_username) {
            let conflict = sqlx::query("SELECT id FROM users WHERE username = $1")
                .bind(new_username)
                .fetch_optional(&state.pool)
                .await?;
            if conflict.is_some() {
                return Err(AppError::Conflict("Username already exists".to_string()));
            }

            sqlx::query("UPDATE users SET username = $1 WHERE id = $2")
                .bind(new_username)
                .bind(auth.0)
                .execute(&state.pool)
                .await?;
        }
    }

    let loc = payload.location.or(payload.address_display);
    sqlx::query(
        r#"
        INSERT INTO user_profiles (user_id, name, preferred_color, address_display, latitude, longitude, bio, time_zone, auto_timezone, location_visibility)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id) DO UPDATE SET
            name = COALESCE($2, user_profiles.name),
            preferred_color = COALESCE($3, user_profiles.preferred_color),
            address_display = COALESCE($4, user_profiles.address_display),
            latitude = COALESCE($5, user_profiles.latitude),
            longitude = COALESCE($6, user_profiles.longitude),
            bio = COALESCE($7, user_profiles.bio),
            time_zone = COALESCE($8, user_profiles.time_zone),
            auto_timezone = COALESCE($9, user_profiles.auto_timezone),
            location_visibility = COALESCE($10, user_profiles.location_visibility)
        "#,
    )
    .bind(auth.0)
    .bind(&payload.name)
    .bind(&payload.preferred_color)
    .bind(&loc)
    .bind(payload.latitude)
    .bind(payload.longitude)
    .bind(&payload.bio)
    .bind(&payload.time_zone)
    .bind(payload.auto_timezone)
    .bind(&payload.location_visibility)
    .execute(&state.pool)
    .await?;

    if let Some(tags) = &payload.tags {
        let profile_row = sqlx::query("SELECT id FROM user_profiles WHERE user_id = $1")
            .bind(auth.0)
            .fetch_one(&state.pool)
            .await?;
        let prof_id: i64 = profile_row.get("id");

        sqlx::query("DELETE FROM user_profile_tags WHERE user_profile_id = $1")
            .bind(prof_id)
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
                "INSERT INTO user_profile_tags (user_profile_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(prof_id)
            .bind(tag_id)
            .execute(&state.pool)
            .await;
        }
    }

    get_profile(auth, State(state)).await
}

async fn search_users_route(
    auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<ProfileDto>>, AppError> {
    let my_profile = get_profile(auth, State(state.clone())).await?.0;
    let my_tags = my_profile.tags.unwrap_or_default();

    let mut results = search_users(
        &state.pool,
        &state.config,
        &state.http_client,
        &query.query,
        &my_tags,
        my_profile.latitude,
        my_profile.longitude,
    )
    .await;

    if let Some(my_uname) = &my_profile.username {
        results.retain(|p| p.username.as_ref() != Some(my_uname));
    }

    Ok(Json(results))
}

async fn get_user_meta(
    Path(user_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<UserMetaDto>, AppError> {
    let user = sqlx::query(
        r#"
        SELECT u.email, u.username, u.email_verified, u.email_bounced,
               u.email_notifications_enabled, u.notification_window_start,
               u.notification_window_end, u.notification_frequency, up.time_zone
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let tz: Option<String> = user.get("time_zone");

    Ok(Json(UserMetaDto {
        email: user.get("email"),
        username: user.get("username"),
        timezone: tz.unwrap_or_else(|| "UTC".to_string()),
        email_verified: user.get("email_verified"),
        email_bounced: user.get("email_bounced"),
        email_notifications_enabled: user.get("email_notifications_enabled"),
        notification_window_start: user.get("notification_window_start"),
        notification_window_end: user.get("notification_window_end"),
        notification_frequency: user.get("notification_frequency"),
    }))
}

async fn unsubscribe_user(
    Path(user_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query("UPDATE users SET email_notifications_enabled = false WHERE id = $1")
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    Ok(StatusCode::OK)
}

// ─── Password & OTP ──────────────────────────────────────────────────────────

async fn send_otp(
    State(state): State<AppState>,
    Json(payload): Json<SendOtpRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let otp: String = format!("{:06}", rand::thread_rng().gen_range(100000..=999999));
    {
        let mut store = OTP_STORE.lock().unwrap();
        store.insert(
            payload.email.clone(),
            (otp.clone(), std::time::Instant::now() + std::time::Duration::from_secs(600)),
        );
    }

    let subject = "Your Habition Verification Code";
    let html = format!(
        "<p>Hello,</p><p>Your verification code is: <strong>{}</strong></p><p>Valid for 10 minutes.</p>",
        otp
    );
    let _ = send_email(&state.config, &payload.email, subject, &html).await;

    Ok(Json(json!({ "status": "OTP sent" })))
}

async fn forgot_password(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    send_otp(State(state), Json(SendOtpRequest { email: payload.email })).await
}

async fn reset_password(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let is_valid = {
        let store = OTP_STORE.lock().unwrap();
        if let Some((stored_otp, expiry)) = store.get(&payload.email) {
            std::time::Instant::now() < *expiry && stored_otp == &payload.otp
        } else {
            false
        }
    };

    if !is_valid {
        return Err(AppError::BadRequest("Invalid or expired OTP".to_string()));
    }

    let new_hash = hash(&payload.new_password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE email = $2")
        .bind(new_hash)
        .bind(&payload.email)
        .execute(&state.pool)
        .await?;

    let mut store = OTP_STORE.lock().unwrap();
    store.remove(&payload.email);

    Ok(Json(json!({ "status": "Password reset successful" })))
}

async fn change_password(
    auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user = sqlx::query("SELECT password_hash FROM users WHERE id = $1")
        .bind(auth.0)
        .fetch_one(&state.pool)
        .await?;

    let hash_str: String = user.get("password_hash");

    if !verify(&payload.current_password, &hash_str).unwrap_or(false) {
        return Err(AppError::Unauthorized("Current password is incorrect".to_string()));
    }

    let new_hash = hash(&payload.new_password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(new_hash)
        .bind(auth.0)
        .execute(&state.pool)
        .await?;

    Ok(Json(json!({ "status": "Password changed successfully" })))
}

// ─── Friendships ─────────────────────────────────────────────────────────────

async fn get_friendships(
    auth: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<FriendshipDto>>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
               u.id as friend_user_id, u.username as friend_username,
               up.name as friend_name, up.preferred_color as friend_color,
               up.address_display as friend_address, up.bio as friend_bio
        FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
        LEFT JOIN user_profiles up ON up.user_id = u.id
        WHERE f.requester_id = $1 OR f.addressee_id = $1
        ORDER BY f.created_at DESC
        "#,
    )
    .bind(auth.0)
    .fetch_all(&state.pool)
    .await?;

    let mut result: Vec<FriendshipDto> = Vec::new();
    for r in rows {
        let req_id: i64 = r.get("requester_id");
        let is_requester = req_id == auth.0;
        let fid: i64 = r.get("friend_user_id");
        let funame: Option<String> = r.get("friend_username");
        let fname: Option<String> = r.get("friend_name");
        let fcolor: Option<String> = r.get("friend_color");
        let faddr: Option<String> = r.get("friend_address");
        let fbio: Option<String> = r.get("friend_bio");
        let status: String = r.get("status");
        let created_at: NaiveDateTime = r.get("created_at");

        result.push(FriendshipDto {
            id: r.get("id"),
            friend_id: fid,
            friend_profile: ProfileDto {
                username: funame,
                name: fname,
                preferred_color: fcolor,
                address_display: faddr.clone(),
                location: faddr,
                bio: fbio,
                ..Default::default()
            },
            status,
            is_requester,
            created_at: DateTime::from_naive_utc_and_offset(created_at, Utc),
        });
    }

    Ok(Json(result))
}

async fn send_friend_request(
    auth: AuthUser,
    Path(username): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let target = sqlx::query("SELECT id FROM users WHERE username = $1")
        .bind(&username)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    let target_id: i64 = target.get("id");
    if target_id == auth.0 {
        return Err(AppError::BadRequest("Cannot friend yourself".to_string()));
    }

    sqlx::query(
        r#"
        INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES ($1, $2, 'PENDING')
        ON CONFLICT (requester_id, addressee_id) DO NOTHING
        "#,
    )
    .bind(auth.0)
    .bind(target_id)
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "status": "Request sent" })))
}

async fn accept_friend_request(
    auth: AuthUser,
    Path(friendship_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows_affected = sqlx::query(
        "UPDATE friendships SET status = 'ACCEPTED' WHERE id = $1 AND addressee_id = $2",
    )
    .bind(friendship_id)
    .bind(auth.0)
    .execute(&state.pool)
    .await?
    .rows_affected();

    if rows_affected == 0 {
        return Err(AppError::NotFound("Pending friend request not found".to_string()));
    }

    Ok(Json(json!({ "status": "Friend request accepted" })))
}

async fn remove_friend(
    auth: AuthUser,
    Path(friendship_id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, AppError> {
    sqlx::query(
        "DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)",
    )
    .bind(friendship_id)
    .bind(auth.0)
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::OK)
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/check-username", get(check_username))
        .route("/users", get(get_users_by_ids))
        .route("/users/by-username", get(get_user_by_username))
        .route("/profile", get(get_profile).put(update_profile))
        .route("/search", get(search_users_route))
        .route("/users/:id/meta", get(get_user_meta))
        .route("/users/:id/unsubscribe", post(unsubscribe_user))
        .route("/send-otp", post(send_otp))
        .route("/forgot-password", post(forgot_password))
        .route("/reset-password", post(reset_password))
        .route("/users/me/password", put(change_password))
        .route("/friends", get(get_friendships))
        .route("/friends/request/:username", post(send_friend_request))
        .route("/friends/accept/:id", put(accept_friend_request))
        .route("/friends/:id", delete(remove_friend))
}
