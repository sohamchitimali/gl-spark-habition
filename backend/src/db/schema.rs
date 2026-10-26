use sqlx::PgPool;
use tracing::info;

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    info!("Running database initialization and schema setup...");

    // Create schemas if supported
    let _ = sqlx::query("CREATE SCHEMA IF NOT EXISTS habition_users").execute(pool).await;
    let _ = sqlx::query("CREATE SCHEMA IF NOT EXISTS habition_groups").execute(pool).await;
    let _ = sqlx::query("CREATE SCHEMA IF NOT EXISTS habition_habits").execute(pool).await;
    let _ = sqlx::query("CREATE SCHEMA IF NOT EXISTS habition_notifications").execute(pool).await;

    // Set search path so all schemas and public are accessible
    let _ = sqlx::query("SET search_path TO public, habition_users, habition_groups, habition_habits, habition_notifications").execute(pool).await;

    // Users and Profiles
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            refresh_token VARCHAR(255),
            username VARCHAR(100) UNIQUE,
            email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            email_bounced BOOLEAN NOT NULL DEFAULT FALSE,
            email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            notification_window_start VARCHAR(10) NOT NULL DEFAULT '09:00',
            notification_window_end VARCHAR(10) NOT NULL DEFAULT '21:00',
            notification_frequency INTEGER NOT NULL DEFAULT 3,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

        CREATE TABLE IF NOT EXISTS user_profiles (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255),
            preferred_color VARCHAR(50) DEFAULT '#534AB7',
            bio TEXT,
            habit_goals VARCHAR(255),
            languages VARCHAR(255),
            time_zone VARCHAR(100) DEFAULT 'UTC',
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            address_display VARCHAR(255),
            location_visibility VARCHAR(50) DEFAULT 'PUBLIC',
            user_theme VARCHAR(50),
            auto_timezone BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE IF NOT EXISTS tags (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_profile_tags (
            user_profile_id BIGINT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
            tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (user_profile_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS friendships (
            id BIGSERIAL PRIMARY KEY,
            requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            addressee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(requester_id, addressee_id)
        );

        -- Habit Groups
        CREATE TABLE IF NOT EXISTS habit_groups (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            invite_code VARCHAR(50) UNIQUE NOT NULL,
            owner_id BIGINT NOT NULL,
            competition_start_date TIMESTAMP,
            competition_end_date TIMESTAMP,
            competition_active BOOLEAN NOT NULL DEFAULT FALSE,
            description TEXT,
            duration VARCHAR(100),
            visibility VARCHAR(50) DEFAULT 'INVITE_ONLY',
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            address_display VARCHAR(255),
            member_count INTEGER DEFAULT 0,
            notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            canonical_day_anchor_timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
            consistency_score DOUBLE PRECISION,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            current_global_habit_group_streak INTEGER,
            highest_habit_group_streak INTEGER
        );

        CREATE TABLE IF NOT EXISTS group_tags (
            group_id BIGINT NOT NULL REFERENCES habit_groups(id) ON DELETE CASCADE,
            tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (group_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS group_members (
            id BIGSERIAL PRIMARY KEY,
            group_id BIGINT NOT NULL REFERENCES habit_groups(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL,
            joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
            is_admin BOOLEAN DEFAULT FALSE,
            total_coins INTEGER DEFAULT 0,
            previous_rank INTEGER,
            UNIQUE(group_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS group_habits (
            id BIGSERIAL PRIMARY KEY,
            group_id BIGINT NOT NULL REFERENCES habit_groups(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS group_join_requests (
            id BIGSERIAL PRIMARY KEY,
            group_id BIGINT NOT NULL REFERENCES habit_groups(id) ON DELETE CASCADE,
            applicant_id BIGINT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
            initial_message TEXT,
            response_message TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS group_blocks (
            id BIGSERIAL PRIMARY KEY,
            group_id BIGINT NOT NULL REFERENCES habit_groups(id) ON DELETE CASCADE,
            blocked_user_id BIGINT NOT NULL,
            blocked_by_user_id BIGINT NOT NULL,
            blocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(group_id, blocked_user_id)
        );

        CREATE TABLE IF NOT EXISTS direct_messages (
            id BIGSERIAL PRIMARY KEY,
            sender_id BIGINT NOT NULL,
            receiver_id BIGINT,
            group_id BIGINT,
            chat_type VARCHAR(50) NOT NULL DEFAULT 'DIRECT_MESSAGE',
            content TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_dm_participants ON direct_messages(sender_id, receiver_id);
        CREATE INDEX IF NOT EXISTS idx_dm_group ON direct_messages(group_id);

        CREATE TABLE IF NOT EXISTS coin_transactions (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            amount INTEGER NOT NULL,
            reason VARCHAR(255),
            group_id BIGINT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );

        -- Habits & Tasks
        CREATE TABLE IF NOT EXISTS habits (
            id BIGSERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            user_id BIGINT NOT NULL,
            group_id BIGINT,
            group_habit_id BIGINT,
            created_at DATE NOT NULL DEFAULT CURRENT_DATE
        );
        CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
        CREATE INDEX IF NOT EXISTS idx_habits_group ON habits(group_id);

        CREATE TABLE IF NOT EXISTS habit_tasks (
            id BIGSERIAL PRIMARY KEY,
            habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            last_completed_date DATE
        );
        CREATE INDEX IF NOT EXISTS idx_habit_tasks_habit ON habit_tasks(habit_id);

        CREATE TABLE IF NOT EXISTS habit_completions (
            id BIGSERIAL PRIMARY KEY,
            habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
            user_id BIGINT NOT NULL,
            completion_date DATE NOT NULL,
            completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(habit_id, user_id, completion_date)
        );
        CREATE INDEX IF NOT EXISTS idx_completions_user_date ON habit_completions(user_id, completion_date);

        CREATE TABLE IF NOT EXISTS heatmap_records (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT,
            group_id BIGINT,
            record_date DATE NOT NULL,
            total_tasks INTEGER NOT NULL,
            completed_tasks INTEGER NOT NULL,
            completion_percentage INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_heatmap_user ON heatmap_records(user_id, record_date);
        CREATE INDEX IF NOT EXISTS idx_heatmap_group ON heatmap_records(group_id, record_date);

        CREATE TABLE IF NOT EXISTS daily_streak_snapshots (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            group_id BIGINT,
            snapshot_date DATE NOT NULL,
            streak_earned BOOLEAN NOT NULL,
            total_habits INTEGER NOT NULL,
            completed_habits INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_streak_user_group ON daily_streak_snapshots(user_id, group_id, snapshot_date);

        -- Notifications
        CREATE TABLE IF NOT EXISTS notification_schedules (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) UNIQUE NOT NULL,
            timezone VARCHAR(100) NOT NULL,
            window_start VARCHAR(10) NOT NULL,
            window_end VARCHAR(10) NOT NULL,
            frequency INTEGER NOT NULL,
            next_execution_at TIMESTAMP NOT NULL,
            current_cycle_index INTEGER NOT NULL,
            version INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            notification_date DATE NOT NULL,
            cycle_index INTEGER NOT NULL,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE(user_id, notification_date, cycle_index)
        );

        CREATE TABLE IF NOT EXISTS notification_deliveries (
            id VARCHAR(64) PRIMARY KEY,
            notification_id VARCHAR(64) NOT NULL,
            channel VARCHAR(50) NOT NULL,
            payload TEXT NOT NULL,
            status VARCHAR(50) NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            next_retry_at TIMESTAMP,
            last_error TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            processed_at TIMESTAMP,
            UNIQUE(notification_id, channel)
        );

        CREATE TABLE IF NOT EXISTS job_outbox (
            id VARCHAR(64) PRIMARY KEY,
            job_type VARCHAR(100) NOT NULL,
            payload TEXT NOT NULL,
            scheduled_at TIMESTAMP NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
            attempt_count INTEGER NOT NULL DEFAULT 0,
            last_attempted_at TIMESTAMP,
            last_error TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        "#
    )
    .execute(pool)
    .await?;

    info!("Database initialization complete.");
    Ok(())
}

