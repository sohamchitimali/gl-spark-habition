use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitTaskResponse {
    pub id: i64,
    pub habit_id: i64,
    pub title: String,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HabitResponse {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub user_id: i64,
    pub group_id: Option<i64>,
    pub group_habit_id: Option<i64>,
    pub completed_today: bool,
    pub tasks: Vec<HabitTaskResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapDay {
    pub date: NaiveDate,
    pub completion_percentage: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeatmapResponse {
    pub user_id: Option<i64>,
    pub group_id: Option<i64>,
    pub days: Vec<HeatmapDay>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreakResponse {
    pub user_id: i64,
    pub current_streak: i32,
    pub personal_best: i32,
    pub today_earned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteHabitResponse {
    pub habit_id: i64,
    pub completed_on: NaiveDate,
    pub current_streak: i32,
    pub coins_earned: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub title: String,
}
