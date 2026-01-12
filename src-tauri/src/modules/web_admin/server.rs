use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    middleware as axum_middleware,
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
#[cfg(feature = "desktop")]
use tauri::AppHandle;
use tokio::net::TcpListener;
use tracing::info;
use rust_embed::Embed;

use crate::modules::web_admin::{assets::Assets, handlers, middleware, websocket, Result, WebAdminError, context::ServiceContext};
use crate::modules::config::load_app_config;

#[cfg(feature = "desktop")]
pub async fn start_server(app_handle: &AppHandle) -> Result<()> {
    start_server_with_context(ServiceContext::from_app_handle(app_handle.clone())).await
}

#[cfg(not(feature = "desktop"))]
pub async fn start_server_standalone() -> Result<()> {
    start_server_with_context(ServiceContext::new()).await
}

async fn start_server_with_context(_context: ServiceContext) -> Result<()> {
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

    // Build protected routes with auth middleware
    let protected_routes = Router::new()
        .route("/api/v1/dashboard/stats", get(handlers::dashboard::get_stats))
        .route("/api/v1/accounts", get(handlers::account::list_accounts).post(handlers::account::add_account))
        .route("/api/v1/accounts/:id", get(handlers::account::get_account).patch(handlers::account::update_account).delete(handlers::account::delete_account))
        .route("/api/v1/accounts/:id/refresh", post(handlers::account::refresh_account))
        .route("/api/v1/system/logs/files", get(handlers::system::list_log_files))
        .route("/api/v1/system/logs", get(handlers::system::get_logs))
        .layer(axum_middleware::from_fn(middleware::auth_middleware));

    // Build public routes (no auth required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/auth/login", post(handlers::auth::login))
        .route("/api/v1/ws", get(websocket::ws_handler))
        .route("/", get(redirect_to_admin))
        .route("/admin", get(serve_admin_html))
        .route("/assets/*path", get(serve_asset))
        .fallback(static_handler);

    // Combine routes
    let app = public_routes
        .merge(protected_routes)
        .with_state(ws_state);

    let listener = TcpListener::bind(addr).await?;

    axum::serve(listener, app.into_make_service())
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
    use rust_embed::Embed;

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
