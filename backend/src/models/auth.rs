use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthRequestDto {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
    #[allow(dead_code)]
    pub otp: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponseDto {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleAuthRequest {
    pub credential: Option<String>,
    pub access_token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRequestDto {
    pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileDto {
    pub id: i64,
    pub email: String,
    pub username: Option<String>,
    pub name: Option<String>,
    pub user_theme: Option<String>,
    pub address_display: Option<String>,
    pub bio: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileDto {
    pub username: Option<String>,
    pub name: Option<String>,
    pub user_theme: Option<String>,
    pub preferred_color: Option<String>,
    pub address_display: Option<String>,
    pub location: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub bio: Option<String>,
    pub time_zone: Option<String>,
    pub experience: Option<String>,
    pub schedule: Option<String>,
    pub location_visibility: Option<String>,
    pub tags: Option<Vec<String>>,
    pub auto_timezone: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FriendshipDto {
    pub id: i64,
    pub friend_id: i64,
    pub friend_profile: ProfileDto,
    pub status: String,
    pub is_requester: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetPasswordRequest {
    pub email: String,
    pub otp: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendOtpRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserMetaDto {
    pub email: String,
    pub username: Option<String>,
    pub timezone: String,
    pub email_verified: bool,
    pub email_bounced: bool,
    pub email_notifications_enabled: bool,
    pub notification_window_start: String,
    pub notification_window_end: String,
    pub notification_frequency: i32,
}
