use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    middleware as axum_middleware,
    response::{IntoResponse, Redirect, Response},
    routing::{get, patch, post, put},
    Router,
};
use std::net::SocketAddr;
#[cfg(feature = "desktop")]
use tauri::AppHandle;
use tokio::net::TcpListener;
use tower_http::cors::{CorsLayer, Any};
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

async fn start_server_with_context(context: ServiceContext) -> Result<()> {
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

    #[cfg(feature = "desktop")]
    if let Some(app) = &context.app_handle {
        use tauri::Manager;
        app.manage(ws_state.clone());
    }

    // Build protected routes with auth middleware
    #[cfg(feature = "desktop")]
    let protected_routes = {
        Router::new()
            .route("/api/v1/dashboard/stats", get(handlers::dashboard::get_stats))
            .route("/api/v1/accounts", get(handlers::account::list_accounts).post(handlers::account::add_account))
            .route("/api/v1/accounts/:id", get(handlers::account::get_account).patch(handlers::account::update_account).delete(handlers::account::delete_account))
            .route("/api/v1/accounts/:id/refresh", post(handlers::account::refresh_account))
            .route("/api/v1/system/logs/files", get(handlers::system::list_log_files))
            .route("/api/v1/system/logs", get(handlers::system::get_logs))
            .route("/api/v1/proxy/status", get(handlers::proxy::get_status))
            .route("/api/v1/proxy/start", post(handlers::proxy::start_proxy))
            .route("/api/v1/proxy/stop", post(handlers::proxy::stop_proxy))
            .route("/api/v1/proxy/restart", post(handlers::proxy::restart_proxy))
            .route("/api/v1/proxy/config", get(handlers::proxy::get_config).put(handlers::proxy::update_config).patch(handlers::proxy::patch_config))
            .route("/api/v1/proxy/config/export", post(handlers::proxy::export_config))
            .route("/api/v1/proxy/config/import", post(handlers::proxy::import_config))
            .layer(axum_middleware::from_fn(middleware::auth_middleware))
            .with_state(context.app_handle.clone().unwrap())
    };

    #[cfg(not(feature = "desktop"))]
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

    // Create CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(false);

    // Combine routes
    let app = public_routes
        .merge(protected_routes)
        .layer(cors)
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
