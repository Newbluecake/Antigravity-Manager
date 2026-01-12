/// Encryption configuration for Antigravity Manager
///
/// Determines whether to encrypt tokens based on the runtime environment:
/// - Server mode (Docker): Always encrypt (requires ANTIGRAVITY_MASTER_KEY)
/// - Desktop mode: Optional, can be enabled via config

use once_cell::sync::Lazy;

/// Global flag indicating whether encryption should be enabled
static ENCRYPTION_ENABLED: Lazy<bool> = Lazy::new(|| {
    // Server mode (feature flag) always requires encryption
    #[cfg(feature = "server")]
    {
        true
    }

    // Desktop mode: Check environment variable or config
    #[cfg(not(feature = "server"))]
    {
        // For now, desktop mode uses plain text for backward compatibility
        // Future: Add config option to enable encryption
        std::env::var("ANTIGRAVITY_ENABLE_ENCRYPTION")
            .map(|v| v == "1" || v.to_lowercase() == "true")
            .unwrap_or(false)
    }
});

/// Check if encryption is enabled for the current runtime
pub fn is_encryption_enabled() -> bool {
    *ENCRYPTION_ENABLED
}

/// Force enable encryption (for testing or manual migration)
/// Note: This only works if called before first access to ENCRYPTION_ENABLED
#[allow(dead_code)]
pub fn force_enable_encryption() {
    std::env::set_var("ANTIGRAVITY_ENABLE_ENCRYPTION", "1");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(feature = "server")]
    fn test_server_mode_always_encrypted() {
        assert!(is_encryption_enabled());
    }

    #[test]
    #[cfg(not(feature = "server"))]
    fn test_desktop_mode_respects_env() {
        // This test depends on whether ANTIGRAVITY_ENABLE_ENCRYPTION is set
        // In CI without the var, it should be false
        let expected = std::env::var("ANTIGRAVITY_ENABLE_ENCRYPTION")
            .map(|v| v == "1" || v.to_lowercase() == "true")
            .unwrap_or(false);

        assert_eq!(is_encryption_enabled(), expected);
    }
}
