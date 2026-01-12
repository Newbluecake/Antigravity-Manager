use axum::{extract::State, Json};
use tauri::{AppHandle, Manager};

use crate::commands::proxy::{self, ProxyServiceState, ProxyStatus};
use crate::modules::web_admin::{Result, WebAdminError};
use crate::proxy::ProxyConfig;

/// GET /api/v1/proxy/status
pub async fn get_status(
    State(app): State<AppHandle>,
) -> Result<Json<ProxyStatus>> {
    let state = app.state::<ProxyServiceState>();

    // We can reuse the command implementation logic
    // Or just implement the read logic here since it's simple
    let instance_lock = state.instance.read().await;

    let status = match instance_lock.as_ref() {
        Some(instance) => ProxyStatus {
            running: true,
            port: instance.config.port,
            base_url: format!("http://127.0.0.1:{}", instance.config.port),
            active_accounts: instance.token_manager.len(),
        },
        None => ProxyStatus {
            running: false,
            port: 0,
            base_url: String::new(),
            active_accounts: 0,
        },
    };

    Ok(Json(status))
}

/// POST /api/v1/proxy/start
pub async fn start_proxy(
    State(app): State<AppHandle>,
    Json(config): Json<ProxyConfig>,
) -> Result<Json<ProxyStatus>> {
    let state = app.state::<ProxyServiceState>();

    match proxy::start_proxy_service(config, state, app.clone()).await {
        Ok(status) => Ok(Json(status)),
        Err(e) => Err(WebAdminError::ServerError(e)),
    }
}

/// POST /api/v1/proxy/stop
pub async fn stop_proxy(
    State(app): State<AppHandle>,
) -> Result<Json<()>> {
    let state = app.state::<ProxyServiceState>();

    match proxy::stop_proxy_service(state).await {
        Ok(_) => Ok(Json(())),
        Err(e) => Err(WebAdminError::ServerError(e)),
    }
}
