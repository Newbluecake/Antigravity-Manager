use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::{distributions::Alphanumeric, Rng};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::modules::web_admin::{db, Result, WebAdminError};

const JWT_SECRET_KEY: &str = "jwt_secret";
const TOKEN_EXPIRY_HOURS: i64 = 24;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // Subject (user identifier)
    pub exp: usize,  // Expiration time (as UTC timestamp)
    pub iat: usize,  // Issued at (as UTC timestamp)
    pub jti: String, // JWT ID
}

fn generate_secret() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

fn get_jwt_secret() -> Result<String> {
    let conn = db::get_connection()?;
    let secret: Option<String> = conn
        .query_row(
            "SELECT value FROM admin_config WHERE key = ?",
            [JWT_SECRET_KEY],
            |row| row.get(0),
        )
        .optional()?;

    if let Some(s) = secret {
        Ok(s)
    } else {
        let new_secret = generate_secret();
        conn.execute(
            "INSERT INTO admin_config (key, value) VALUES (?, ?)",
            [JWT_SECRET_KEY, &new_secret],
        )?;
        Ok(new_secret)
    }
}

pub fn create_token(user_id: &str) -> Result<(String, i64)> {
    let secret = get_jwt_secret()?;
    let now = Utc::now();
    let expiry = now + Duration::hours(TOKEN_EXPIRY_HOURS);
    let expiry_ts = expiry.timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiry_ts,
        iat: now.timestamp() as usize,
        jti: Uuid::new_v4().to_string(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok((token, expiry.timestamp()))
}

pub fn verify_token(token: &str) -> Result<Claims> {
    let secret = get_jwt_secret()?;
    let validation = Validation::default();

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;

    // Check if revoked
    let conn = db::get_connection()?;
    let revoked: bool = conn
        .query_row(
            "SELECT 1 FROM revoked_tokens WHERE jti = ?",
            [&token_data.claims.jti],
            |_| Ok(true),
        )
        .optional()?
        .unwrap_or(false);

    if revoked {
        return Err(WebAdminError::AuthError("Token has been revoked".to_string()));
    }

    Ok(token_data.claims)
}

pub fn revoke_token(jti: &str, expiry: i64) -> Result<()> {
    let conn = db::get_connection()?;
    let now = Utc::now().timestamp();
    conn.execute(
        "INSERT INTO revoked_tokens (jti, expiry, revoked_at) VALUES (?, ?, ?)",
        [jti, &expiry.to_string(), &now.to_string()],
    )?;
    Ok(())
}
