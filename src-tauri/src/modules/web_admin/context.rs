/// Service Context for Web Admin
///
/// This module provides an abstraction over Tauri's AppHandle to allow Web Admin
/// to work in both desktop (Tauri) and server (standalone) modes.

use tauri::AppHandle;

/// ServiceContext provides access to application services without direct Tauri dependency
///
/// Note: For Phase 2, we keep using AppHandle directly in handlers.
/// Full abstraction will be implemented when creating the standalone server binary in Phase 3.
#[derive(Clone)]
pub struct ServiceContext {
    /// Optional AppHandle for desktop mode features
    #[cfg(feature = "desktop")]
    pub app_handle: Option<AppHandle>,
}

impl ServiceContext {
    /// Create a new ServiceContext from a Tauri AppHandle (desktop mode)
    #[cfg(feature = "desktop")]
    pub fn from_app_handle(app: AppHandle) -> Self {
        Self {
            app_handle: Some(app),
        }
    }

    /// Create a new ServiceContext for server mode (no AppHandle)
    #[cfg(feature = "server")]
    pub fn new() -> Self {
        Self {}
    }

    /// Check if running in desktop mode (has AppHandle)
    #[cfg(feature = "desktop")]
    pub fn is_desktop(&self) -> bool {
        self.app_handle.is_some()
    }

    /// Check if running in desktop mode (server always returns false)
    #[cfg(not(feature = "desktop"))]
    pub fn is_desktop(&self) -> bool {
        false
    }

    /// Get the AppHandle (desktop mode only)
    #[cfg(feature = "desktop")]
    pub fn app_handle(&self) -> Option<&AppHandle> {
        self.app_handle.as_ref()
    }
}

// For backward compatibility with existing handlers that expect AppHandle in State
impl From<AppHandle> for ServiceContext {
    fn from(app: AppHandle) -> Self {
        #[cfg(feature = "desktop")]
        {
            Self::from_app_handle(app)
        }
        #[cfg(not(feature = "desktop"))]
        {
            // This shouldn't happen in server mode, but provide a fallback
            panic!("Cannot create ServiceContext from AppHandle in server mode");
        }
    }
}
