use crate::{
    config::AppConfig,
    models::{auth::ProfileDto, group::GroupResponse},
    utils::geo::compute_ranking_score,
};
use chrono::NaiveDateTime;
use serde_json::json;
use sqlx::{PgPool, Row};

pub async fn search_users(
    pool: &PgPool,
    config: &AppConfig,
    client: &reqwest::Client,
    query: &str,
    user_tags: &[String],
    user_lat: Option<f64>,
    user_lng: Option<f64>,
) -> Vec<ProfileDto> {
    let mut candidate_ids: Vec<i64> = Vec::new();
    if !config.meilisearch_host.is_empty() {
        let url = format!("{}/indexes/users/search", config.meilisearch_host);
        let body = json!({
            "q": query,
            "limit": 100
        });

        let mut req = client.post(&url).json(&body);
        if !config.meilisearch_api_key.is_empty() {
            req = req.bearer_auth(&config.meilisearch_api_key);
        }

        if let Ok(resp) = req.send().await {
            if resp.status().is_success() {
                if let Ok(val) = resp.json::<serde_json::Value>().await {
                    if let Some(hits) = val["hits"].as_array() {
                        for h in hits {
                            if let Some(id) = h["id"].as_i64() {
                                candidate_ids.push(id);
                            }
                        }
                    }
                }
            }
        }
    }

    let users_rows = if candidate_ids.is_empty() {
        let pattern = format!("%{}%", query);
        sqlx::query(
            r#"
            SELECT u.id, u.username, up.name, up.preferred_color, up.address_display,
                   up.latitude, up.longitude, up.bio, up.time_zone, up.location_visibility, up.auto_timezone
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.username ILIKE $1 OR up.name ILIKE $1
            LIMIT 100
            "#,
        )
        .bind(pattern)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query(
            r#"
            SELECT u.id, u.username, up.name, up.preferred_color, up.address_display,
                   up.latitude, up.longitude, up.bio, up.time_zone, up.location_visibility, up.auto_timezone
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = ANY($1)
            "#,
        )
        .bind(&candidate_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    };

    let mut profiles: Vec<ProfileDto> = Vec::new();
    for row in users_rows {
        let uid: i64 = row.get("id");
        let uname: Option<String> = row.get("username");
        let name: Option<String> = row.get("name");
        let pref_color: Option<String> = row.get("preferred_color");
        let address: Option<String> = row.get("address_display");
        let lat: Option<f64> = row.get("latitude");
        let lng: Option<f64> = row.get("longitude");
        let bio: Option<String> = row.get("bio");
        let tz: Option<String> = row.get("time_zone");
        let loc_vis: Option<String> = row.get("location_visibility");
        let auto_tz: Option<bool> = row.get("auto_timezone");

        let tag_rows = sqlx::query(
            r#"
            SELECT t.name FROM tags t
            JOIN user_profile_tags upt ON t.id = upt.tag_id
            JOIN user_profiles up ON upt.user_profile_id = up.id
            WHERE up.user_id = $1
            "#,
        )
        .bind(uid)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let tags: Vec<String> = tag_rows.into_iter().map(|t| t.get("name")).collect();

        profiles.push(ProfileDto {
            username: uname,
            name,
            user_theme: None,
            preferred_color: pref_color,
            address_display: address.clone(),
            location: address,
            latitude: lat,
            longitude: lng,
            bio,
            time_zone: tz,
            experience: None,
            schedule: None,
            location_visibility: loc_vis,
            tags: Some(tags),
            auto_timezone: auto_tz,
        });
    }

    profiles.sort_by(|a, b| {
        let score_a = compute_ranking_score(
            user_tags,
            a.tags.as_deref().unwrap_or(&[]),
            user_lat,
            user_lng,
            a.latitude,
            a.longitude,
            None,
        );
        let score_b = compute_ranking_score(
            user_tags,
            b.tags.as_deref().unwrap_or(&[]),
            user_lat,
            user_lng,
            b.latitude,
            b.longitude,
            None,
        );
        score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    profiles
}

pub async fn search_groups(
    pool: &PgPool,
    config: &AppConfig,
    client: &reqwest::Client,
    query: &str,
    user_tags: &[String],
    user_lat: Option<f64>,
    user_lng: Option<f64>,
) -> Vec<GroupResponse> {
    let mut candidate_ids: Vec<i64> = Vec::new();

    if !config.meilisearch_host.is_empty() {
        let url = format!("{}/indexes/groups/search", config.meilisearch_host);
        let body = json!({
            "q": query,
            "filter": "visibility = 'PUBLIC' OR visibility = 'OPEN'",
            "limit": 100
        });

        let mut req = client.post(&url).json(&body);
        if !config.meilisearch_api_key.is_empty() {
            req = req.bearer_auth(&config.meilisearch_api_key);
        }

        if let Ok(resp) = req.send().await {
            if resp.status().is_success() {
                if let Ok(val) = resp.json::<serde_json::Value>().await {
                    if let Some(hits) = val["hits"].as_array() {
                        for h in hits {
                            if let Some(id) = h["id"].as_i64() {
                                candidate_ids.push(id);
                            }
                        }
                    }
                }
            }
        }
    }

    let group_rows = if candidate_ids.is_empty() {
        let pattern = format!("%{}%", query);
        sqlx::query(
            r#"
            SELECT id, name, invite_code, owner_id, competition_end_date, description,
                   duration, visibility, latitude, longitude, address_display,
                   member_count, notifications_enabled, consistency_score,
                   current_global_habit_group_streak, highest_habit_group_streak, created_at
            FROM habit_groups
            WHERE (visibility = 'PUBLIC' OR visibility = 'OPEN')
              AND (name ILIKE $1 OR description ILIKE $1)
            LIMIT 100
            "#,
        )
        .bind(pattern)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query(
            r#"
            SELECT id, name, invite_code, owner_id, competition_end_date, description,
                   duration, visibility, latitude, longitude, address_display,
                   member_count, notifications_enabled, consistency_score,
                   current_global_habit_group_streak, highest_habit_group_streak, created_at
            FROM habit_groups
            WHERE id = ANY($1)
            "#,
        )
        .bind(&candidate_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    };

    let mut groups: Vec<GroupResponse> = Vec::new();
    for g in group_rows {
        let gid: i64 = g.get("id");
        let name: String = g.get("name");
        let invite_code: String = g.get("invite_code");
        let owner_id: i64 = g.get("owner_id");
        let comp_end: Option<NaiveDateTime> = g.get("competition_end_date");
        let desc: Option<String> = g.get("description");
        let dur: Option<String> = g.get("duration");
        let vis: Option<String> = g.get("visibility");
        let lat: Option<f64> = g.get("latitude");
        let lng: Option<f64> = g.get("longitude");
        let addr: Option<String> = g.get("address_display");
        let mem_count: Option<i32> = g.get("member_count");
        let notif_en: bool = g.get("notifications_enabled");
        let cons_score: Option<f64> = g.get("consistency_score");
        let curr_streak: Option<i32> = g.get("current_global_habit_group_streak");
        let high_streak: Option<i32> = g.get("highest_habit_group_streak");
        let created_at: NaiveDateTime = g.get("created_at");

        let member_rows = sqlx::query("SELECT user_id, is_admin FROM group_members WHERE group_id = $1")
            .bind(gid)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let member_ids: Vec<i64> = member_rows.iter().map(|m| m.get("user_id")).collect();
        let admin_ids: Vec<i64> = member_rows
            .iter()
            .filter(|m| m.get::<Option<bool>, _>("is_admin").unwrap_or(false))
            .map(|m| m.get("user_id"))
            .collect();

        let habit_rows = sqlx::query("SELECT id, title, description FROM group_habits WHERE group_id = $1")
            .bind(gid)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

        let habits = habit_rows
            .into_iter()
            .map(|h| crate::models::group::GroupHabitResponse {
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
        .bind(gid)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let tags: Vec<String> = tag_rows.into_iter().map(|t| t.get("name")).collect();

        groups.push(GroupResponse {
            id: gid,
            name,
            invite_code,
            owner_id,
            member_ids: member_ids.clone(),
            admin_ids,
            habits,
            description: desc,
            duration: dur,
            competition_end_date: comp_end,
            visibility: vis,
            has_pending_requests: Some(false),
            current_user_requested: Some(false),
            latitude: lat,
            longitude: lng,
            address_display: addr,
            tags,
            consistency_score: cons_score,
            current_global_habit_group_streak: curr_streak,
            highest_habit_group_streak: high_streak,
            created_at: Some(created_at),
            member_count: Some(mem_count.unwrap_or(member_ids.len() as i32)),
            notifications_enabled: Some(notif_en),
        });
    }

    groups.sort_by(|a, b| {
        let score_a = compute_ranking_score(
            user_tags,
            &a.tags,
            user_lat,
            user_lng,
            a.latitude,
            a.longitude,
            a.member_count,
        );
        let score_b = compute_ranking_score(
            user_tags,
            &b.tags,
            user_lat,
            user_lng,
            b.latitude,
            b.longitude,
            b.member_count,
        );
        score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    groups
}

pub async fn sync_user_meilisearch(config: &AppConfig, client: &reqwest::Client, user_id: i64, username: &str, name: &str, tags: &[String]) {
    if config.meilisearch_host.is_empty() { return; }
    let url = format!("{}/indexes/users/documents", config.meilisearch_host);
    let doc = json!([{
        "id": user_id,
        "username": username,
        "name": name,
        "tags": tags
    }]);

    let mut req = client.post(&url).json(&doc);
    if !config.meilisearch_api_key.is_empty() {
        req = req.bearer_auth(&config.meilisearch_api_key);
    }
    let _ = req.send().await;
}

pub async fn sync_group_meilisearch(config: &AppConfig, client: &reqwest::Client, group_id: i64, name: &str, description: &str, tags: &[String], visibility: &str) {
    if config.meilisearch_host.is_empty() { return; }
    let url = format!("{}/indexes/groups/documents", config.meilisearch_host);
    let doc = json!([{
        "id": group_id,
        "name": name,
        "description": description,
        "tags": tags,
        "visibility": visibility
    }]);

    let mut req = client.post(&url).json(&doc);
    if !config.meilisearch_api_key.is_empty() {
        req = req.bearer_auth(&config.meilisearch_api_key);
    }
    let _ = req.send().await;
}

pub async fn initial_sync_to_meilisearch(pool: &PgPool, config: &AppConfig, client: &reqwest::Client) {
    if config.meilisearch_host.is_empty() {
        tracing::info!("Meilisearch host not configured; pure PostgreSQL search engine will be used.");
        return;
    }

    tracing::info!("Checking internal Meilisearch availability at {}...", config.meilisearch_host);

    // Wait up to 10 seconds for Meilisearch to become available
    let mut available = false;
    let health_url = format!("{}/health", config.meilisearch_host);
    for _ in 0..20 {
        if let Ok(resp) = client.get(&health_url).send().await {
            if resp.status().is_success() {
                available = true;
                break;
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }

    if !available {
        tracing::warn!("Internal Meilisearch is not reachable at {}; continuing with PostgreSQL fallback.", config.meilisearch_host);
        return;
    }

    tracing::info!("Meilisearch is healthy. Synchronizing existing users and groups from database...");

    // Configure groups index filterable attributes
    let settings_url = format!("{}/indexes/groups/settings", config.meilisearch_host);
    let mut settings_req = client.patch(&settings_url).json(&json!({
        "filterableAttributes": ["visibility"]
    }));
    if !config.meilisearch_api_key.is_empty() {
        settings_req = settings_req.bearer_auth(&config.meilisearch_api_key);
    }
    let _ = settings_req.send().await;

    // Fetch and index all users from PostgreSQL
    let users_res = sqlx::query(
        r#"
        SELECT u.id, u.username, COALESCE(p.name, '') as name
        FROM users u
        LEFT JOIN user_profiles p ON u.id = p.user_id
        WHERE u.username IS NOT NULL
        "#
    ).fetch_all(pool).await;

    if let Ok(users) = users_res {
        let mut user_docs = Vec::new();
        for u in users {
            let id: i64 = u.get("id");
            let username: String = u.get("username");
            let name: String = u.get("name");

            let tags: Vec<String> = sqlx::query_scalar(
                r#"
                SELECT t.name FROM tags t
                JOIN user_profile_tags upt ON t.id = upt.tag_id
                JOIN user_profiles p ON upt.user_profile_id = p.id
                WHERE p.user_id = $1
                "#
            )
            .bind(id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

            user_docs.push(json!({
                "id": id,
                "username": username,
                "name": name,
                "tags": tags
            }));
        }

        if !user_docs.is_empty() {
            let user_docs_url = format!("{}/indexes/users/documents", config.meilisearch_host);
            let mut req = client.post(&user_docs_url).json(&user_docs);
            if !config.meilisearch_api_key.is_empty() {
                req = req.bearer_auth(&config.meilisearch_api_key);
            }
            let _ = req.send().await;
            tracing::info!("Synced {} users to Meilisearch", user_docs.len());
        }
    }

    // Fetch and index all groups from PostgreSQL
    let groups_res = sqlx::query(
        r#"
        SELECT id, name, COALESCE(description, '') as description, visibility
        FROM habit_groups
        "#
    ).fetch_all(pool).await;

    if let Ok(groups) = groups_res {
        let mut group_docs = Vec::new();
        for g in groups {
            let id: i64 = g.get("id");
            let name: String = g.get("name");
            let description: String = g.get("description");
            let visibility: String = g.get("visibility");

            let tags: Vec<String> = sqlx::query_scalar(
                r#"
                SELECT t.name FROM tags t
                JOIN group_tags gt ON t.id = gt.tag_id
                WHERE gt.group_id = $1
                "#
            )
            .bind(id)
            .fetch_all(pool)
            .await
            .unwrap_or_default();

            group_docs.push(json!({
                "id": id,
                "name": name,
                "description": description,
                "tags": tags,
                "visibility": visibility
            }));
        }

        if !group_docs.is_empty() {
            let group_docs_url = format!("{}/indexes/groups/documents", config.meilisearch_host);
            let mut req = client.post(&group_docs_url).json(&group_docs);
            if !config.meilisearch_api_key.is_empty() {
                req = req.bearer_auth(&config.meilisearch_api_key);
            }
            let _ = req.send().await;
            tracing::info!("Synced {} groups to Meilisearch", group_docs.len());
        }
    }
}


