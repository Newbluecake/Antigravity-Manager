pub mod error;
pub mod server;
pub mod auth;
pub mod db;
pub mod handlers;
pub mod middleware;
pub mod websocket;

use tauri::AppHandle;
use tracing::info;

pub use error::{Result, WebAdminError};

pub fn init(app: &AppHandle) -> Result<()> {
    info!("Initializing Web Admin module...");

    // Initialize database
    db::init_db(app)?;

    // Start server in background
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = server::start_server(&app_handle).await {
            tracing::error!("Web Admin server error: {}", e);
        }
    });

    info!("Web Admin module initialized");
    Ok(())
}
