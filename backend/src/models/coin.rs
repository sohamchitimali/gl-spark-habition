use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditCoinsRequest {
    pub user_id: i64,
    pub amount: i32,
    pub reason: Option<String>,
    pub group_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub previous_rank: Option<i32>,
    pub user_id: i64,
    pub total_coins: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardResponse {
    pub group_id: i64,
    pub entries: Vec<LeaderboardEntry>,
    pub winner_id: Option<i64>,
}
