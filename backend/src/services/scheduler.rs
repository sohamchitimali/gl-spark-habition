use crate::{
    config::AppConfig,
    services::{email::send_email, gemini::compose_habit_digest},
};
use chrono::{DateTime, Duration, NaiveDateTime, NaiveTime, TimeZone, Utc};
use chrono_tz::Tz;
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::time::sleep;
use tracing::{error, info};

pub fn validate_window(window_start: &str, window_end: &str, frequency: i32) -> Result<(), String> {
    let start = NaiveTime::parse_from_str(window_start, "%H:%M")
        .map_err(|_| "Invalid window start time format (use HH:MM)".to_string())?;
    let end = NaiveTime::parse_from_str(window_end, "%H:%M")
        .map_err(|_| "Invalid window end time format (use HH:MM)".to_string())?;

    if start >= end {
        return Err("Window start must be before window end".to_string());
    }

    let duration_mins = (end - start).num_minutes();
    if duration_mins < 360 {
        return Err("Notification window must be at least 6 hours wide".to_string());
    }

    if end > NaiveTime::from_hms_opt(23, 0, 0).unwrap() {
        return Err("Notification window must end by 23:00 local time".to_string());
    }

    let max_freq = 6.min((duration_mins / 60) as i32);
    if frequency < 2 || frequency > max_freq {
        return Err(format!(
            "Frequency must be between 2 and {} for this window",
            max_freq
        ));
    }

    Ok(())
}

pub fn compute_next_slot(
    timezone_str: &str,
    window_start: &str,
    window_end: &str,
    frequency: i32,
    cycle_index: i32,
) -> Result<NaiveDateTime, String> {
    let tz: Tz = timezone_str
        .parse()
        .map_err(|_| format!("Invalid timezone: {}", timezone_str))?;

    let now_tz = Utc::now().with_timezone(&tz);
    let today = now_tz.date_naive();

    let start_time = NaiveTime::parse_from_str(window_start, "%H:%M")
        .map_err(|_| "Invalid start time".to_string())?;
    let end_time = NaiveTime::parse_from_str(window_end, "%H:%M")
        .map_err(|_| "Invalid end time".to_string())?;

    let window_duration = (end_time - start_time).num_seconds();
    let interval_secs = window_duration / (frequency as i64);

    let mut slots: Vec<DateTime<Tz>> = Vec::new();
    for i in 0..frequency {
        let slot_time = start_time + Duration::seconds(interval_secs * i as i64);
        if let Some(dt) = tz.from_local_datetime(&today.and_time(slot_time)).single() {
            slots.push(dt);
        }
    }

    for i in cycle_index..frequency {
        if (i as usize) < slots.len() {
            let candidate = slots[i as usize];
            if candidate > now_tz {
                return Ok(candidate.naive_utc());
            }
        }
    }

    let tomorrow = today + Duration::days(1);
    let tomorrow_first = tz
        .from_local_datetime(&tomorrow.and_time(start_time))
        .single()
        .ok_or_else(|| "Failed to compute tomorrow's slot".to_string())?;

    Ok(tomorrow_first.naive_utc())
}

pub fn start_scheduler(pool: PgPool, config: Arc<AppConfig>, client: reqwest::Client) {
    tokio::spawn(async move {
        info!("Starting background notification scheduler...");
        loop {
            if let Err(e) = run_notification_cycle(&pool, &config, &client).await {
                error!("Error in background notification cycle: {:?}", e);
            }
            sleep(std::time::Duration::from_secs(30)).await;
        }
    });
}

async fn run_notification_cycle(
    pool: &PgPool,
    config: &AppConfig,
    client: &reqwest::Client,
) -> Result<(), anyhow::Error> {
    let now = Utc::now().naive_utc();

    let schedules = sqlx::query(
        r#"
        SELECT id, user_id, timezone, window_start, window_end, frequency,
               current_cycle_index, next_execution_at
        FROM notification_schedules
        WHERE next_execution_at <= $1
        LIMIT 25
        "#,
    )
    .bind(now)
    .fetch_all(pool)
    .await?;

    for s in schedules {
        let schedule_id: String = s.get("id");
        let uid_str: String = s.get("user_id");
        let timezone: String = s.get("timezone");
        let window_start: String = s.get("window_start");
        let window_end: String = s.get("window_end");
        let frequency: i32 = s.get("frequency");
        let current_cycle_index: i32 = s.get("current_cycle_index");

        let user_id: i64 = uid_str.parse().unwrap_or(0);
        if user_id == 0 {
            continue;
        }

        let user_opt = sqlx::query(
            "SELECT email, username, email_notifications_enabled FROM users WHERE id = $1",
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

        let (user_email, username) = match user_opt {
            Some(u) => {
                let enabled: bool = u.get("email_notifications_enabled");
                if !enabled {
                    continue;
                }
                let email: String = u.get("email");
                let uname: Option<String> = u.get("username");
                (email, uname)
            }
            None => continue,
        };

        let today = Utc::now().date_naive();

        let habit_rows = sqlx::query("SELECT id, title FROM habits WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(pool)
            .await?;

        if !habit_rows.is_empty() {
            let completion_rows = sqlx::query(
                "SELECT habit_id FROM habit_completions WHERE user_id = $1 AND completion_date = $2",
            )
            .bind(user_id)
            .bind(today)
            .fetch_all(pool)
            .await?;

            let completed_ids: std::collections::HashSet<i64> = completion_rows
                .into_iter()
                .map(|c| c.get::<i64, _>("habit_id"))
                .collect();

            let incomplete_habits: Vec<String> = habit_rows
                .iter()
                .filter(|h| !completed_ids.contains(&h.get::<i64, _>("id")))
                .map(|h| h.get::<String, _>("title"))
                .collect();

            let total_habits = habit_rows.len();
            let completed_count = total_habits - incomplete_habits.len();

            if incomplete_habits.is_empty() {
                info!(
                    "User {} completed 100% of habits today! Suppressing notification email.",
                    user_id
                );
            } else {
                let streak = 0;
                let unsubscribe_token = base64::Engine::encode(
                    &base64::engine::general_purpose::URL_SAFE_NO_PAD,
                    format!("{}:unsubscribe", user_id),
                );
                let unsubscribe_url = format!(
                    "{}/notifications/unsubscribe?userId={}&token={}",
                    config.app_base_url, user_id, unsubscribe_token
                );

                let digest = compose_habit_digest(
                    config,
                    client,
                    username.as_deref().unwrap_or("Friend"),
                    streak,
                    &incomplete_habits,
                    completed_count,
                    total_habits,
                    &unsubscribe_url,
                )
                .await;

                let _ = send_email(config, &user_email, &digest.subject, &digest.html_body).await;
            }
        }

        let next_cycle = (current_cycle_index + 1) % frequency;
        if let Ok(next_slot) = compute_next_slot(
            &timezone,
            &window_start,
            &window_end,
            frequency,
            next_cycle,
        ) {
            let _ = sqlx::query(
                r#"
                UPDATE notification_schedules
                SET current_cycle_index = $1, next_execution_at = $2, version = version + 1
                WHERE id = $3
                "#,
            )
            .bind(next_cycle)
            .bind(next_slot)
            .bind(schedule_id)
            .execute(pool)
            .await;
        }
    }

    Ok(())
}

