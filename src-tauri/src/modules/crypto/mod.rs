/// Encryption and secret storage module for Antigravity Manager
///
/// This module provides encryption for sensitive data (tokens) and abstracts
/// secret storage to support both desktop (system keyring) and server (environment variable) modes.

pub mod store;
pub mod cipher;
pub mod config;

pub use store::{SecretStore, SystemKeyring, EnvKeyring};
pub use cipher::{encrypt_string, decrypt_string};
pub use config::is_encryption_enabled;

use once_cell::sync::Lazy;
use std::sync::RwLock;

/// Global secret store instance
static SECRET_STORE: Lazy<RwLock<Box<dyn SecretStore>>> = Lazy::new(|| {
    #[cfg(feature = "server")]
    {
        RwLock::new(Box::new(EnvKeyring::new()))
    }
    #[cfg(not(feature = "server"))]
    {
        RwLock::new(Box::new(SystemKeyring::new()))
    }
});

/// Get the master key from the configured secret store
pub fn get_master_key() -> Result<Vec<u8>, String> {
    let store = SECRET_STORE.read()
        .map_err(|e| format!("Failed to acquire read lock on secret store: {}", e))?;

    store.get_master_key()
}

/// Initialize the secret store with a custom implementation
/// This is useful for testing or when runtime feature selection is needed
pub fn init_secret_store(store: Box<dyn SecretStore>) -> Result<(), String> {
    let mut global_store = SECRET_STORE.write()
        .map_err(|e| format!("Failed to acquire write lock on secret store: {}", e))?;

    *global_store = store;
    Ok(())
}
