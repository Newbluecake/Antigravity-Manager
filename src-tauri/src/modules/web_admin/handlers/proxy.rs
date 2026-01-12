#![cfg(feature = "desktop")]

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

/// POST /api/v1/proxy/restart
pub async fn restart_proxy(
    State(app): State<AppHandle>,
) -> Result<Json<ProxyStatus>> {
    let state = app.state::<ProxyServiceState>();

    // First stop the proxy
    match proxy::stop_proxy_service(state.clone()).await {
        Ok(_) => {},
        Err(e) => return Err(WebAdminError::ServerError(e)),
    }

    // Then get the current config and restart
    let config = match get_config(State(app.clone())).await {
        Ok(Json(cfg)) => cfg,
        Err(e) => return Err(e),
    };

    // Start with the loaded config
    match proxy::start_proxy_service(config, state.clone(), app.clone()).await {
        Ok(status) => Ok(Json(status)),
        Err(e) => Err(WebAdminError::ServerError(e)),
    }
}

/// GET /api/v1/proxy/config
pub async fn get_config(
    State(app): State<AppHandle>,
) -> Result<Json<ProxyConfig>> {
    // Load from app config
    let app_config = crate::modules::config::load_app_config()
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(app_config.proxy))
}

/// PUT /api/v1/proxy/config (full update)
pub async fn update_config(
    State(_app): State<AppHandle>,
    Json(config): Json<ProxyConfig>,
) -> Result<Json<()>> {
    // Load current app config
    let mut app_config = crate::modules::config::load_app_config()
        .map_err(|e| WebAdminError::ServerError(e))?;

    // Replace proxy config
    app_config.proxy = config;

    // Save to file
    crate::modules::config::save_app_config(&app_config)
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(()))
}

/// PATCH /api/v1/proxy/config (partial update)
pub async fn patch_config(
    State(_app): State<AppHandle>,
    Json(partial): Json<serde_json::Value>,
) -> Result<Json<()>> {
    // Load current app config
    let mut app_config = crate::modules::config::load_app_config()
        .map_err(|e| WebAdminError::ServerError(e))?;

    // Serialize current proxy config to JSON value
    let mut current_json = serde_json::to_value(&app_config.proxy)
        .map_err(|e| WebAdminError::ServerError(e.to_string()))?;

    // Merge the partial update
    if let (serde_json::Value::Object(current_map), serde_json::Value::Object(patch_map)) =
        (&mut current_json, &partial) {
        for (key, value) in patch_map {
            current_map.insert(key.clone(), value.clone());
        }
    }

    // Deserialize back to ProxyConfig
    let updated_config: ProxyConfig = serde_json::from_value(current_json)
        .map_err(|e| WebAdminError::ServerError(e.to_string()))?;

    // Update app config
    app_config.proxy = updated_config;

    // Save to file
    crate::modules::config::save_app_config(&app_config)
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(()))
}
