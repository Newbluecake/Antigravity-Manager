/// AES-256-GCM encryption/decryption for sensitive data
///
/// Uses the master key from SecretStore to encrypt/decrypt strings.
/// The encrypted format is: nonce(12 bytes) || ciphertext || tag(16 bytes)
/// All encoded as base64 for JSON serialization.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

/// Encrypt a string using AES-256-GCM
///
/// # Arguments
/// * `plaintext` - The string to encrypt
/// * `key` - 32-byte encryption key
///
/// # Returns
/// Base64-encoded string containing: nonce(12) || ciphertext || tag(16)
pub fn encrypt_string(plaintext: &str, key: &[u8]) -> Result<String, String> {
    if key.len() != 32 {
        return Err("Encryption key must be exactly 32 bytes".to_string());
    }

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Generate random 12-byte nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine nonce + ciphertext and encode as base64
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);

    Ok(base64::encode(&result))
}

/// Decrypt a string using AES-256-GCM
///
/// # Arguments
/// * `ciphertext_b64` - Base64-encoded encrypted data (nonce || ciphertext || tag)
/// * `key` - 32-byte decryption key
///
/// # Returns
/// Decrypted plaintext string
pub fn decrypt_string(ciphertext_b64: &str, key: &[u8]) -> Result<String, String> {
    if key.len() != 32 {
        return Err("Decryption key must be exactly 32 bytes".to_string());
    }

    // Decode base64
    let data = base64::decode(ciphertext_b64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    if data.len() < 12 {
        return Err("Ciphertext too short (missing nonce)".to_string());
    }

    // Split nonce and ciphertext
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Decrypt
    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext_bytes)
        .map_err(|e| format!("Decrypted data is not valid UTF-8: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = [42u8; 32]; // Test key
        let plaintext = "This is a secret refresh token: 1//0a1b2c3d4e5f";

        let encrypted = encrypt_string(plaintext, &key).unwrap();
        assert_ne!(encrypted, plaintext); // Should be different

        let decrypted = decrypt_string(&encrypted, &key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_produces_different_ciphertexts() {
        let key = [42u8; 32];
        let plaintext = "same plaintext";

        let encrypted1 = encrypt_string(plaintext, &key).unwrap();
        let encrypted2 = encrypt_string(plaintext, &key).unwrap();

        // Due to random nonce, ciphertexts should differ
        assert_ne!(encrypted1, encrypted2);

        // But both should decrypt to the same plaintext
        assert_eq!(decrypt_string(&encrypted1, &key).unwrap(), plaintext);
        assert_eq!(decrypt_string(&encrypted2, &key).unwrap(), plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = [42u8; 32];
        let key2 = [99u8; 32];
        let plaintext = "secret";

        let encrypted = encrypt_string(plaintext, &key1).unwrap();
        let result = decrypt_string(&encrypted, &key2);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Decryption failed"));
    }

    #[test]
    fn test_invalid_key_length() {
        let bad_key = [42u8; 16]; // Wrong length
        let result = encrypt_string("test", &bad_key);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must be exactly 32 bytes"));
    }

    #[test]
    fn test_corrupted_ciphertext() {
        let key = [42u8; 32];
        let plaintext = "test";

        let mut encrypted = encrypt_string(plaintext, &key).unwrap();
        // Corrupt the base64 string
        encrypted.push_str("CORRUPTED");

        let result = decrypt_string(&encrypted, &key);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_plaintext() {
        let key = [42u8; 32];
        let plaintext = "";

        let encrypted = encrypt_string(plaintext, &key).unwrap();
        let decrypted = decrypt_string(&encrypted, &key).unwrap();

        assert_eq!(decrypted, plaintext);
    }
}
