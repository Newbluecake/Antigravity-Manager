use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WebAdminError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),

    #[error("JWT error: {0}")]
    JwtError(#[from] jsonwebtoken::errors::Error),

    #[error("Server error: {0}")]
    ServerError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

impl Serialize for WebAdminError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_str())
    }
}

impl IntoResponse for WebAdminError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            WebAdminError::AuthError(msg) => (StatusCode::UNAUTHORIZED, msg),
            WebAdminError::ConfigError(msg) => (StatusCode::BAD_REQUEST, msg),
            WebAdminError::DatabaseError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
            WebAdminError::JwtError(e) => (StatusCode::UNAUTHORIZED, e.to_string()),
            WebAdminError::ServerError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            WebAdminError::IoError(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, WebAdminError>;
