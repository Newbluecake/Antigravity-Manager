use axum::{Json, response::IntoResponse};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

use crate::modules::web_admin::{auth, WebAdminError, Result};

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    token: String,
    expires_at: i64,
}

pub async fn login(
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse> {
    // TODO: Load password hash from DB or config. For MVP, use "admin".
    // In a real implementation, this should verify against a stored hash.
    if payload.password != "admin" {
        warn!("Failed login attempt");
        return Err(WebAdminError::AuthError("Invalid password".to_string()));
    }

    info!("Admin logged in successfully");
    let (token, expires_at) = auth::create_token("admin")?;

    Ok(Json(LoginResponse {
        token,
        expires_at,
    }))
}
