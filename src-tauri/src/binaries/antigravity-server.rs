/// Antigravity Manager - Standalone Server Mode
///
/// This binary runs the Antigravity Manager as a headless server without Tauri/GUI dependencies.
/// Designed for Docker/VPS deployments.
///
/// Required Environment Variables:
/// - ANTIGRAVITY_MASTER_KEY: Master encryption key (min 16 chars, recommend 32+)
///
/// Optional Environment Variables:
/// - ANTIGRAVITY_DATA_DIR: Custom data directory (default: ~/.antigravity_tools)
/// - ANTIGRAVITY_WEB_ADMIN_PORT: Web Admin port (default: 8046)
/// - ANTIGRAVITY_PROXY_PORT: Proxy service port (default: 8045)

use std::sync::Arc;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Re-use the library components
use antigravity_tools_lib::commands::proxy::ProxyServiceState;
use antigravity_tools_lib::modules::web_admin;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    init_logging();

    info!("🚀 Antigravity Manager - Server Mode");
    info!("Version: {}", env!("CARGO_PKG_VERSION"));

    // Validate required environment variables
    validate_environment()?;

    // Initialize proxy service state (TODO: use in Phase 3 auto-start)
    let _proxy_state = Arc::new(ProxyServiceState::new());

    // Start Web Admin server
    info!("Starting Web Admin server...");
    let web_admin_handle = tokio::spawn(async move {
        if let Err(e) = web_admin::init_standalone().await {
            error!("Web Admin initialization error: {}", e);
        }
    });

    // Start proxy service (if auto-start is configured)
    // TODO: Load config from file/env and auto-start if needed

    // Wait for shutdown signal
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal, stopping services...");
        }
        _ = web_admin_handle => {
            error!("Web Admin server stopped unexpectedly");
        }
    }

    info!("Antigravity Manager server stopped");
    Ok(())
}

/// Initialize logging system
fn init_logging() {
    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().with_target(false))
        .init();
}

/// Validate required environment variables
fn validate_environment() -> Result<(), Box<dyn std::error::Error>> {
    // Check for master key (required in server mode)
    if std::env::var("ANTIGRAVITY_MASTER_KEY").is_err() {
        return Err(
            "ANTIGRAVITY_MASTER_KEY environment variable is required in server mode.\n\
            Please set it to a strong, random passphrase (32+ characters recommended).\n\
            Example: ANTIGRAVITY_MASTER_KEY=your-secure-random-passphrase-here"
                .into(),
        );
    }

    // Verify the key is long enough
    let key = std::env::var("ANTIGRAVITY_MASTER_KEY")?;
    if key.len() < 16 {
        return Err(
            "ANTIGRAVITY_MASTER_KEY is too short. Please use at least 16 characters.\n\
            For production deployments, 32+ characters are recommended."
                .into(),
        );
    }

    info!("✅ Environment validation passed");
    Ok(())
}

