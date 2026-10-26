use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupInsightDTO {
    pub group_id: i64,
    pub health_status: String, // 'AT_RISK' | 'HEALTHY' | 'EXCELLENT'
    pub overall_consistency_score: f64,
    pub top_performers: Vec<String>,
    pub struggling_members: Vec<String>,
    pub suggested_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInsightDTO {
    pub user_id: i64,
    pub personal_consistency_score: f64,
    pub recent_achievements: Vec<String>,
    pub areas_for_improvement: Vec<String>,
    pub predicted_next_milestone: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettingsRequest {
    pub timezone: Option<String>,
    pub window_start: Option<String>,
    pub window_end: Option<String>,
    pub frequency: Option<i32>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettingsResponse {
    pub enabled: bool,
    pub timezone: Option<String>,
    pub window_start: Option<String>,
    pub window_end: Option<String>,
    pub frequency: Option<i32>,
    pub next_execution_at: Option<NaiveDateTime>,
}
