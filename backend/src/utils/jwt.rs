use crate::error::AppError;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
}

pub fn generate_access_token(user_id: i64, secret: &str) -> Result<String, AppError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?
        .as_secs() as usize;

    // 24 hours expiry
    let exp = now + (24 * 3600);

    let claims = Claims {
        sub: user_id.to_string(),
        exp,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encoding error: {}", e)))
}

pub fn verify_access_token(token: &str, secret: &str) -> Result<i64, AppError> {
    let mut validation = Validation::default();
    validation.validate_exp = true;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

    let user_id = token_data
        .claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::Unauthorized("Invalid subject in token".to_string()))?;

    Ok(user_id)
}

pub fn generate_refresh_token() -> String {
    Uuid::new_v4().to_string()
}

