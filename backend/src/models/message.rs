use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectMessageResponse {
    pub id: i64,
    pub sender_id: i64,
    pub receiver_id: Option<i64>,
    pub group_id: Option<i64>,
    pub chat_type: String,
    pub content: String,
    pub is_read: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessagePayload {
    pub receiver_id: Option<i64>,
    pub content: String,
    pub group_id: Option<i64>,
    pub chat_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSummary {
    pub unread_messages_count: i32,
    pub pending_join_requests_count: i32,
}

