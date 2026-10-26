use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupHabitResponse {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupResponse {
    pub id: i64,
    pub name: String,
    pub invite_code: String,
    pub owner_id: i64,
    pub member_ids: Vec<i64>,
    pub admin_ids: Vec<i64>,
    pub habits: Vec<GroupHabitResponse>,
    pub description: Option<String>,
    pub duration: Option<String>,
    pub competition_end_date: Option<NaiveDateTime>,
    pub visibility: Option<String>,
    pub has_pending_requests: Option<bool>,
    pub current_user_requested: Option<bool>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address_display: Option<String>,
    pub tags: Vec<String>,
    pub consistency_score: Option<f64>,
    pub current_global_habit_group_streak: Option<i32>,
    pub highest_habit_group_streak: Option<i32>,
    pub created_at: Option<NaiveDateTime>,
    pub member_count: Option<i32>,
    pub notifications_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupRequest {
    pub name: String,
    pub description: Option<String>,
    pub visibility: Option<String>,
    pub years: Option<i32>,
    pub months: Option<i32>,
    pub weeks: Option<i32>,
    pub days: Option<i32>,
    pub invite_friend_ids: Option<Vec<i64>>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address_display: Option<String>,
    pub tags: Option<Vec<String>>,
    pub notifications_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupSettingsRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub address_display: Option<String>,
    pub tags: Option<Vec<String>>,
    pub notifications_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinGroupRequest {
    pub invite_code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddHabitRequest {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeDeadlineRequest {
    pub mode: String, // "ADD", "REDUCE", "SET"
    pub years: Option<i32>,
    pub months: Option<i32>,
    pub weeks: Option<i32>,
    pub days: Option<i32>,
    pub new_date: Option<NaiveDateTime>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchGroupRequest {
    pub query: String,
    pub user_tags: Option<Vec<String>>,
    pub user_lat: Option<f64>,
    pub user_lng: Option<f64>,
    #[allow(dead_code)]
    pub radius_km: Option<f64>,
    #[allow(dead_code)]
    pub sort_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SentJoinRequestResponse {
    pub id: i64,
    pub group_id: i64,
    pub group_name: String,
    pub group_description: Option<String>,
    pub group_tags: Option<Vec<String>>,
    pub applicant_id: i64,
    pub status: String,
    pub initial_message: Option<String>,
    pub created_at: Option<NaiveDateTime>,
    pub updated_at: Option<NaiveDateTime>,
}
