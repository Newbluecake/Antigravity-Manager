use axum::{
    body::Body,
    extract::Request,
    http::header,
    middleware::Next,
    response::Response,
};

use crate::modules::web_admin::{auth, WebAdminError};

/// Auth middleware that validates JWT tokens from Authorization header
pub async fn auth_middleware(
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, WebAdminError> {
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let token = auth_header
        .and_then(|h| h.strip_prefix("Bearer "))
        .ok_or_else(|| WebAdminError::AuthError("Missing or invalid Authorization header".to_string()))?;

    let claims = auth::verify_token(token)?;

    // Store claims in request extensions for handlers to use
    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}
