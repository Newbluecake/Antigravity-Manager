/// Secret storage abstraction for master key management
///
/// Provides two implementations:
/// - SystemKeyring: Uses OS keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service)
/// - EnvKeyring: Uses ANTIGRAVITY_MASTER_KEY environment variable (for Docker/server deployments)

use sha2::{Sha256, Digest};

/// Trait for secret storage backends
pub trait SecretStore: Send + Sync {
    /// Retrieve the master encryption key
    /// Returns a 32-byte key suitable for AES-256
    fn get_master_key(&self) -> Result<Vec<u8>, String>;

    /// Set/update the master key (optional, mainly for desktop keyring)
    fn set_master_key(&self, key: &[u8]) -> Result<(), String> {
        let _ = key;
        Err("Setting master key is not supported for this store".to_string())
    }

    /// Delete the master key from storage
    fn delete_master_key(&self) -> Result<(), String> {
        Err("Deleting master key is not supported for this store".to_string())
    }
}

/// Environment variable-based secret store (for server/Docker mode)
///
/// Reads ANTIGRAVITY_MASTER_KEY environment variable and derives a 32-byte key from it.
/// If the key is not set, the container should fail to start.
pub struct EnvKeyring;

impl EnvKeyring {
    pub fn new() -> Self {
        Self
    }

    /// Derive a 32-byte key from the environment variable using SHA-256
    fn derive_key(passphrase: &str) -> Vec<u8> {
        let mut hasher = Sha256::new();
        hasher.update(passphrase.as_bytes());
        hasher.finalize().to_vec()
    }
}

impl SecretStore for EnvKeyring {
    fn get_master_key(&self) -> Result<Vec<u8>, String> {
        let key_str = std::env::var("ANTIGRAVITY_MASTER_KEY")
            .map_err(|_| {
                "ANTIGRAVITY_MASTER_KEY environment variable not set. \
                This is required for encrypting sensitive data in server mode. \
                Please set it to a strong, random passphrase (32+ characters recommended).".to_string()
            })?;

        if key_str.len() < 16 {
            return Err(
                "ANTIGRAVITY_MASTER_KEY is too short. \
                Please use at least 16 characters for security.".to_string()
            );
        }

        Ok(Self::derive_key(&key_str))
    }
}

/// System keyring-based secret store (for desktop mode)
///
/// Uses the `keyring` crate to store the master key in the OS keyring.
/// On first run, generates a random 32-byte key and stores it.
#[cfg(feature = "desktop")]
pub struct SystemKeyring {
    service: String,
    username: String,
}

#[cfg(feature = "desktop")]
impl SystemKeyring {
    pub fn new() -> Self {
        Self {
            service: "com.antigravity.manager".to_string(),
            username: "master_key".to_string(),
        }
    }

    /// Generate a new random 32-byte key
    fn generate_key() -> Vec<u8> {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let mut key = vec![0u8; 32];
        rng.fill(&mut key[..]);
        key
    }
}

#[cfg(feature = "desktop")]
impl SecretStore for SystemKeyring {
    fn get_master_key(&self) -> Result<Vec<u8>, String> {
        // Try to retrieve existing key from keyring
        match keyring::Entry::new(&self.service, &self.username) {
            Ok(entry) => {
                match entry.get_password() {
                    Ok(password) => {
                        // Decode base64-encoded key
                        base64::decode(&password)
                            .map_err(|e| format!("Failed to decode stored key: {}", e))
                    }
                    Err(keyring::Error::NoEntry) => {
                        // First run - generate and store a new key
                        let key = Self::generate_key();
                        let encoded = base64::encode(&key);

                        entry.set_password(&encoded)
                            .map_err(|e| format!("Failed to store master key in keyring: {}", e))?;

                        Ok(key)
                    }
                    Err(e) => Err(format!("Failed to retrieve master key from keyring: {}", e))
                }
            }
            Err(e) => Err(format!("Failed to access system keyring: {}", e))
        }
    }

    fn set_master_key(&self, key: &[u8]) -> Result<(), String> {
        let encoded = base64::encode(key);
        let entry = keyring::Entry::new(&self.service, &self.username)
            .map_err(|e| format!("Failed to access system keyring: {}", e))?;

        entry.set_password(&encoded)
            .map_err(|e| format!("Failed to store master key in keyring: {}", e))
    }

    fn delete_master_key(&self) -> Result<(), String> {
        let entry = keyring::Entry::new(&self.service, &self.username)
            .map_err(|e| format!("Failed to access system keyring: {}", e))?;

        entry.delete_password()
            .map_err(|e| format!("Failed to delete master key from keyring: {}", e))
    }
}

/// Stub implementation for server mode (SystemKeyring not available without keyring feature)
#[cfg(not(feature = "desktop"))]
pub struct SystemKeyring;

#[cfg(not(feature = "desktop"))]
impl SystemKeyring {
    pub fn new() -> Self {
        Self
    }
}

#[cfg(not(feature = "desktop"))]
impl SecretStore for SystemKeyring {
    fn get_master_key(&self) -> Result<Vec<u8>, String> {
        Err("SystemKeyring is not available in server mode. Use EnvKeyring instead.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_env_keyring_missing_var() {
        std::env::remove_var("ANTIGRAVITY_MASTER_KEY");
        let store = EnvKeyring::new();
        assert!(store.get_master_key().is_err());
    }

    #[test]
    fn test_env_keyring_too_short() {
        std::env::set_var("ANTIGRAVITY_MASTER_KEY", "short");
        let store = EnvKeyring::new();
        let result = store.get_master_key();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too short"));
    }

    #[test]
    fn test_env_keyring_valid() {
        std::env::set_var("ANTIGRAVITY_MASTER_KEY", "this-is-a-valid-test-key-with-32-chars!");
        let store = EnvKeyring::new();
        let key = store.get_master_key().unwrap();
        assert_eq!(key.len(), 32); // SHA-256 produces 32 bytes
    }

    #[test]
    fn test_env_keyring_deterministic() {
        std::env::set_var("ANTIGRAVITY_MASTER_KEY", "deterministic-test-key");
        let store = EnvKeyring::new();
        let key1 = store.get_master_key().unwrap();
        let key2 = store.get_master_key().unwrap();
        assert_eq!(key1, key2); // Same passphrase should produce same key
    }
}
