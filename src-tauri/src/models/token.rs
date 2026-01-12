use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenData {
    /// Access token - may be encrypted (base64 ciphertext) or plain text for backward compatibility
    pub access_token: String,
    /// Refresh token - may be encrypted (base64 ciphertext) or plain text for backward compatibility
    pub refresh_token: String,
    pub expires_in: i64,
    pub expiry_timestamp: i64,
    pub token_type: String,
    pub email: Option<String>,
    /// Google Cloud 项目ID，用于 API 请求标识
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,  // 新增：Antigravity sessionId
    /// Flag indicating whether tokens are encrypted (true) or plain text (false)
    /// Added in v3.5.0 for Docker server support
    #[serde(default)]
    pub encrypted: bool,
}

impl TokenData {
    pub fn new(
        access_token: String,
        refresh_token: String,
        expires_in: i64,
        email: Option<String>,
        project_id: Option<String>,
        session_id: Option<String>,
    ) -> Self {
        let expiry_timestamp = chrono::Utc::now().timestamp() + expires_in;
        Self {
            access_token,
            refresh_token,
            expires_in,
            expiry_timestamp,
            token_type: "Bearer".to_string(),
            email,
            project_id,
            session_id,
            encrypted: false, // Plain text by default for backward compatibility
        }
    }

    /// Get the decrypted access token
    /// If encrypted flag is true, decrypts the token; otherwise returns as-is
    pub fn get_access_token(&self) -> Result<String, String> {
        if self.encrypted {
            use crate::modules::crypto::{get_master_key, decrypt_string};
            let key = get_master_key()?;
            decrypt_string(&self.access_token, &key)
        } else {
            Ok(self.access_token.clone())
        }
    }

    /// Get the decrypted refresh token
    /// If encrypted flag is true, decrypts the token; otherwise returns as-is
    pub fn get_refresh_token(&self) -> Result<String, String> {
        if self.encrypted {
            use crate::modules::crypto::{get_master_key, decrypt_string};
            let key = get_master_key()?;
            decrypt_string(&self.refresh_token, &key)
        } else {
            Ok(self.refresh_token.clone())
        }
    }

    /// Update tokens with encryption
    /// Encrypts both access_token and refresh_token if encryption is enabled
    pub fn update_tokens(&mut self, access_token: String, refresh_token: String) -> Result<(), String> {
        if self.encrypted {
            use crate::modules::crypto::{get_master_key, encrypt_string};
            let key = get_master_key()?;
            self.access_token = encrypt_string(&access_token, &key)?;
            self.refresh_token = encrypt_string(&refresh_token, &key)?;
        } else {
            self.access_token = access_token;
            self.refresh_token = refresh_token;
        }
        self.expiry_timestamp = chrono::Utc::now().timestamp() + self.expires_in;
        Ok(())
    }

    /// Encrypt the tokens in-place
    /// Converts plain text tokens to encrypted format
    pub fn encrypt_tokens(&mut self) -> Result<(), String> {
        if self.encrypted {
            return Ok(()); // Already encrypted
        }

        use crate::modules::crypto::{get_master_key, encrypt_string};
        let key = get_master_key()?;

        self.access_token = encrypt_string(&self.access_token, &key)?;
        self.refresh_token = encrypt_string(&self.refresh_token, &key)?;
        self.encrypted = true;

        Ok(())
    }

    /// Decrypt the tokens in-place (for migration purposes)
    /// Converts encrypted tokens back to plain text format
    pub fn decrypt_tokens(&mut self) -> Result<(), String> {
        if !self.encrypted {
            return Ok(()); // Already plain text
        }

        use crate::modules::crypto::{get_master_key, decrypt_string};
        let key = get_master_key()?;

        self.access_token = decrypt_string(&self.access_token, &key)?;
        self.refresh_token = decrypt_string(&self.refresh_token, &key)?;
        self.encrypted = false;

        Ok(())
    }
}
