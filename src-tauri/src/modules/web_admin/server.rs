use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    middleware as axum_middleware,
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tauri::AppHandle;
use tokio::net::TcpListener;
use tracing::info;

use crate::modules::web_admin::{assets::Assets, handlers, middleware, websocket, Result, WebAdminError};
use crate::modules::config::load_app_config;

pub async fn start_server(app_handle: &AppHandle) -> Result<()> {
    let port = 8046;

    // Load configuration to check for LAN access setting
    let config = load_app_config().unwrap_or_default();
    let bind_ip = if config.web_admin_lan_access {
        [0, 0, 0, 0] // Listen on all interfaces
    } else {
        [127, 0, 0, 1] // Listen only on localhost
    };

    let addr = SocketAddr::from((bind_ip, port));

    info!("Starting Web Admin server on {}", addr);

    // Initialize WebSocket state
    let ws_state = websocket::WebSocketState::new();

    // Public routes
    let public_routes = Router::new()
        .route("/auth/login", post(handlers::auth::login))
        .route("/ws", get(websocket::ws_handler))
        .with_state(ws_state.clone());

    // Protected routes
    let protected_routes = Router::new()
        .route("/dashboard/stats", get(handlers::dashboard::get_stats))
        // Proxy routes
        .route("/proxy/status", get(handlers::proxy::get_status))
        .route("/proxy/start", post(handlers::proxy::start_proxy))
        .route("/proxy/stop", post(handlers::proxy::stop_proxy))
        // Account routes
        .route("/accounts", get(handlers::account::list_accounts))
        .route("/accounts/:id", get(handlers::account::get_account).patch(handlers::account::update_account))
        .route("/accounts/:id/refresh", post(handlers::account::refresh_account))
        // System routes
        .route("/system/logs/files", get(handlers::system::list_log_files))
        .route("/system/logs", get(handlers::system::get_logs))
        .layer(axum_middleware::from_fn(middleware::auth_middleware))
        .with_state(app_handle.clone());

    let api_routes = Router::new()
        .merge(public_routes)
        .merge(protected_routes);

    let app = Router::new()
        .route("/health", get(health_check))
        .nest("/api/v1", api_routes)
        .route("/", get(redirect_to_admin))
        .route("/admin", get(serve_admin_html))
        .route("/assets/*path", get(serve_asset))
        .fallback(static_handler)
        .with_state(app_handle.clone());

    let listener = TcpListener::bind(addr).await?;

    axum::serve(listener, app)
        .await
        .map_err(|e| WebAdminError::ServerError(e.to_string()))?;

    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}

async fn redirect_to_admin() -> Redirect {
    Redirect::permanent("/admin")
}

async fn serve_admin_html() -> impl IntoResponse {
    serve_embedded_file("admin.html")
}

async fn serve_asset(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    serve_embedded_file(path)
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    serve_embedded_file(path)
}

fn serve_embedded_file(path: &str) -> Response {
    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime.as_ref())
                .body(Body::from(content.data.into_owned()))
                .unwrap()
        }
        None => Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Body::from("404 Not Found"))
            .unwrap(),
    }
}
