use crate::{error::AppError, state::AppState, utils::jwt::verify_access_token};
use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};

#[derive(Debug, Clone, Copy)]
pub struct AuthUser(pub i64);

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // 1. Try X-User-Id header directly (gateway / proxy compatibility)
        if let Some(user_id_val) = parts.headers.get("x-user-id") {
            if let Ok(user_id_str) = user_id_val.to_str() {
                if let Ok(user_id) = user_id_str.parse::<i64>() {
                    return Ok(AuthUser(user_id));
                }
            }
        }

        // 2. Try Authorization Bearer header
        if let Some(auth_val) = parts.headers.get("authorization") {
            if let Ok(auth_str) = auth_val.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    let app_state = AppState::from_ref(state);
                    let user_id = verify_access_token(token, &app_state.config.jwt_secret)?;
                    return Ok(AuthUser(user_id));
                }
            }
        }

        Err(AppError::Unauthorized(
            "Missing or invalid authentication token".to_string(),
        ))
    }
}

#[derive(Debug, Clone, Copy)]
pub struct OptionalAuthUser(pub Option<i64>);

#[async_trait]
impl<S> FromRequestParts<S> for OptionalAuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // 1. Try X-User-Id
        if let Some(user_id_val) = parts.headers.get("x-user-id") {
            if let Ok(user_id_str) = user_id_val.to_str() {
                if let Ok(user_id) = user_id_str.parse::<i64>() {
                    return Ok(OptionalAuthUser(Some(user_id)));
                }
            }
        }

        // 2. Try Authorization Bearer header
        if let Some(auth_val) = parts.headers.get("authorization") {
            if let Ok(auth_str) = auth_val.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    let app_state = AppState::from_ref(state);
                    if let Ok(user_id) = verify_access_token(token, &app_state.config.jwt_secret) {
                        return Ok(OptionalAuthUser(Some(user_id)));
                    }
                }
            }
        }

        Ok(OptionalAuthUser(None))
    }
}
