use axum::{Extension, Json};
use serde::Serialize;

use crate::modules::web_admin::{auth::Claims, Result};

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    /// Total number of accounts
    pub total_accounts: usize,
    /// Number of active accounts
    pub active_accounts: usize,
    /// Proxy service status
    pub proxy_status: String,
    /// Total requests handled
    pub total_requests: u64,
    /// Total tokens used
    pub total_tokens: u64,
    /// Current requests per minute
    pub requests_per_minute: f64,
}

/// GET /api/v1/dashboard/stats
/// Returns dashboard overview statistics
pub async fn get_stats(
    Extension(_claims): Extension<Claims>,
) -> Result<Json<DashboardStats>> {
    // TODO: Implement actual stats collection from modules
    // For now, return placeholder data
    let stats = DashboardStats {
        total_accounts: 0,
        active_accounts: 0,
        proxy_status: "stopped".to_string(),
        total_requests: 0,
        total_tokens: 0,
        requests_per_minute: 0.0,
    };

    Ok(Json(stats))
}
