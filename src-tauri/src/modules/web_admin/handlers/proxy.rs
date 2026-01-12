#![cfg(feature = "desktop")]

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use axum::extract::Multipart;
use tauri::{AppHandle, Manager};

use crate::commands::proxy::{self, ProxyServiceState, ProxyStatus};
use crate::modules::web_admin::{websocket::{WebSocketEvent, WebSocketState}, Result, WebAdminError};
use crate::proxy::ProxyConfig;

// Helper to broadcast status updates via WebSocket
fn broadcast_status(app: &AppHandle, status: &ProxyStatus) {
    if let Some(ws_state) = app.try_state::<WebSocketState>() {
        let event = WebSocketEvent {
            event_type: "proxy_status_update".to_string(),
            data: serde_json::to_value(status).unwrap_or(serde_json::Value::Null),
        };
        ws_state.broadcast(event);
    }
}

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
        Ok(status) => {
            broadcast_status(&app, &status);
            Ok(Json(status))
        },
        Err(e) => Err(WebAdminError::ServerError(e)),
    }
}

/// POST /api/v1/proxy/stop
pub async fn stop_proxy(
    State(app): State<AppHandle>,
) -> Result<Json<()>> {
    let state = app.state::<ProxyServiceState>();

    match proxy::stop_proxy_service(state).await {
        Ok(_) => {
            let status = ProxyStatus {
                running: false,
                port: 0,
                base_url: String::new(),
                active_accounts: 0,
            };
            broadcast_status(&app, &status);
            Ok(Json(()))
        },
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
        Ok(status) => {
            broadcast_status(&app, &status);
            Ok(Json(status))
        },
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

/// POST /api/v1/proxy/config/export
pub async fn export_config(
    State(_app): State<AppHandle>,
) -> Result<Response> {
    // Load current app config
    let app_config = crate::modules::config::load_app_config()
        .map_err(|e| WebAdminError::ServerError(e))?;

    // Serialize proxy config to JSON
    let json = serde_json::to_string_pretty(&app_config.proxy)
        .map_err(|e| WebAdminError::ServerError(e.to_string()))?;

    // Create response with JSON download
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json")
        .header(
            header::CONTENT_DISPOSITION,
            format!(
                "attachment; filename=\"proxy-config-{}.json\"",
                chrono::Local::now().format("%Y-%m-%d")
            ),
        )
        .body(axum::body::Body::from(json))
        .map_err(|e| WebAdminError::ServerError(e.to_string()))?;

    Ok(response)
}

/// POST /api/v1/proxy/config/import
pub async fn import_config(
    State(_app): State<AppHandle>,
    mut multipart: Multipart,
) -> Result<Json<()>> {
    // Extract file from multipart form
    let mut config_json: Option<String> = None;

    while let Some(field) = multipart.next_field().await
        .map_err(|e| WebAdminError::BadRequest(e.to_string()))? {

        if field.name() == Some("file") {
            let data = field.bytes().await
                .map_err(|e| WebAdminError::BadRequest(e.to_string()))?;

            config_json = Some(String::from_utf8(data.to_vec())
                .map_err(|e| WebAdminError::BadRequest(format!("Invalid UTF-8: {}", e)))?);
            break;
        }
    }

    let config_json = config_json
        .ok_or_else(|| WebAdminError::BadRequest("No file uploaded".to_string()))?;

    // Parse JSON to ProxyConfig
    let imported_config: ProxyConfig = serde_json::from_str(&config_json)
        .map_err(|e| WebAdminError::BadRequest(format!("Invalid JSON: {}", e)))?;

    // Load current app config
    let mut app_config = crate::modules::config::load_app_config()
        .map_err(|e| WebAdminError::ServerError(e))?;

    // Replace proxy config
    app_config.proxy = imported_config;

    // Save to file
    crate::modules::config::save_app_config(&app_config)
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(()))
}
