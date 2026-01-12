# Phase 1 Implementation Notes: Core Abstractions

**Date**: 2025-01-12
**Status**: ✅ Completed
**Branch**: feature/docker-server

## Overview

Phase 1 focused on creating the foundational abstractions needed for the Docker server version, particularly around secret storage and encryption.

## What Was Implemented

### 1. Crypto Module (`src-tauri/src/modules/crypto/`)

Created a comprehensive encryption and secret storage system:

#### 1.1 Secret Store Abstraction (`store.rs`)

- **`SecretStore` trait**: Generic interface for secret storage backends
- **`EnvKeyring`**: Environment variable-based storage (for Docker/server)
  - Reads `ANTIGRAVITY_MASTER_KEY` from environment
  - Derives 32-byte key using SHA-256
  - Validates minimum key length (16 characters)
  - Returns clear error messages if key is missing/invalid
- **`SystemKeyring`**: OS keyring-based storage (for desktop)
  - Uses system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
  - Auto-generates random 32-byte key on first run
  - Conditional compilation: only compiled with `desktop` feature
  - Stub implementation for server mode (returns error)

#### 1.2 Cipher Module (`cipher.rs`)

- **AES-256-GCM encryption**: Industry-standard authenticated encryption
- **`encrypt_string()`**: Encrypts plaintext to base64-encoded ciphertext
  - Random 12-byte nonce per encryption (prevents pattern analysis)
  - Format: `nonce(12 bytes) || ciphertext || tag(16 bytes)`
- **`decrypt_string()`**: Decrypts base64-encoded ciphertext to plaintext
- **Comprehensive tests**: Roundtrip, wrong key, corrupted data, edge cases

#### 1.3 Configuration Module (`config.rs`)

- **`is_encryption_enabled()`**: Runtime flag to control encryption behavior
  - Server mode (`feature = "server"`): Always `true`
  - Desktop mode: Checks `ANTIGRAVITY_ENABLE_ENCRYPTION` env var (default `false`)
- Allows gradual migration without breaking existing desktop installations

### 2. TokenData Model Updates (`src-tauri/src/models/token.rs`)

Extended `TokenData` struct with encryption support:

- **New field**: `encrypted: bool` (default `false` for backward compatibility)
- **New methods**:
  - `get_access_token()`: Returns decrypted access token (transparent decryption)
  - `get_refresh_token()`: Returns decrypted refresh token (transparent decryption)
  - `update_tokens()`: Updates both tokens with encryption if enabled
  - `encrypt_tokens()`: Encrypts plain tokens in-place
  - `decrypt_tokens()`: Decrypts encrypted tokens in-place (for migration)

**Backward Compatibility Strategy**:
- Old accounts without `encrypted` field default to `encrypted: false`
- Tokens read as plain text if `encrypted: false`
- Tokens automatically encrypted on save if `is_encryption_enabled() == true`
- No data loss for existing desktop users

### 3. Data Directory Configuration (`src-tauri/src/modules/account.rs`)

Updated `get_data_dir()` to support environment override:

```rust
pub fn get_data_dir() -> Result<PathBuf, String> {
    let data_dir = if let Ok(custom_dir) = std::env::var("ANTIGRAVITY_DATA_DIR") {
        PathBuf::from(custom_dir)
    } else {
        let home = dirs::home_dir().ok_or("无法获取用户主目录")?;
        home.join(".antigravity_tools")
    };
    // ... ensure directory exists
}
```

**Priority**:
1. `ANTIGRAVITY_DATA_DIR` environment variable (Docker)
2. `~/.antigravity_tools` (default desktop location)

### 4. Account Module Integration (`src-tauri/src/modules/account.rs`)

Updated `save_account()` to automatically encrypt tokens:

```rust
pub fn save_account(account: &Account) -> Result<(), String> {
    let mut account_to_save = account.clone();

    // Auto-encrypt in server mode
    if is_encryption_enabled() && !account_to_save.token.encrypted {
        account_to_save.token.encrypt_tokens()?;
    }

    // ... serialize and write
}
```

### 5. Cargo Configuration (`src-tauri/Cargo.toml`)

Added dependencies and feature flags:

```toml
[dependencies]
aes-gcm = "0.10"
keyring = { version = "2.3", optional = true }

[features]
default = ["desktop"]
desktop = ["keyring"]
server = []
```

**Build Targets**:
- Desktop: `cargo build --features desktop` (includes keyring)
- Server: `cargo build --features server --no-default-features` (no keyring)

## Security Considerations

### Encryption Algorithm
- **AES-256-GCM**: NIST-approved authenticated encryption
- **Key size**: 256 bits (32 bytes)
- **Nonce**: 96 bits (12 bytes), randomly generated per encryption
- **Tag**: 128 bits (16 bytes), prevents tampering

### Key Management
- **Server mode**: User-provided passphrase via `ANTIGRAVITY_MASTER_KEY`
  - Minimum 16 characters enforced
  - Recommend 32+ characters for production
  - **Important**: If key is lost, encrypted data cannot be recovered
- **Desktop mode**: Auto-generated random 32-byte key
  - Stored in OS keyring (encrypted by OS)
  - Transparent to user

### Threat Model
- **Protects against**: File system access, database dump leaks, plain-text token exposure
- **Does NOT protect against**: Memory dumps while app is running, OS keyring compromise, weak `ANTIGRAVITY_MASTER_KEY`

## Testing

### Compilation Tests
✅ Desktop mode: `cargo check --features desktop`
✅ Server mode: `cargo check --features server --no-default-features`
✅ No warnings/errors (except pre-existing dead code warnings)

### Unit Tests
All crypto module tests pass:
- `test_env_keyring_*`: EnvKeyring validation and key derivation
- `test_encrypt_decrypt_*`: AES-GCM roundtrip and edge cases

### Integration Test TODO
- [ ] Test account save/load with encryption enabled
- [ ] Test migration from plain to encrypted tokens
- [ ] Test Docker container startup with valid/invalid `ANTIGRAVITY_MASTER_KEY`

## Migration Path

### For Desktop Users (No Action Required)
- Existing plain-text accounts continue to work
- New accounts saved in plain text (unless `ANTIGRAVITY_ENABLE_ENCRYPTION=1`)
- Optional: Set environment variable to enable encryption for new accounts

### For Server Deployment (Required)
- **Must** set `ANTIGRAVITY_MASTER_KEY` environment variable
- Container fails to start if key is missing (fail-safe)
- All accounts automatically encrypted on save
- **Critical**: Backup the master key securely (e.g., Kubernetes Secret, Docker Swarm secret)

### Manual Migration (Optional)
For desktop users wanting to migrate existing accounts to encrypted format:

```bash
# Enable encryption
export ANTIGRAVITY_ENABLE_ENCRYPTION=1

# Run migration script (TODO: create migration script)
# Or: Re-add accounts via Web Admin (will be encrypted automatically)
```

## Files Changed/Created

### Created
- `src-tauri/src/modules/crypto/mod.rs`
- `src-tauri/src/modules/crypto/store.rs`
- `src-tauri/src/modules/crypto/cipher.rs`
- `src-tauri/src/modules/crypto/config.rs`
- `docs/dev/docker-server/phase1-implementation-notes.md` (this file)

### Modified
- `src-tauri/Cargo.toml`: Added aes-gcm, keyring dependencies, feature flags
- `src-tauri/src/modules/mod.rs`: Added `pub mod crypto;`
- `src-tauri/src/models/token.rs`: Added `encrypted` field and helper methods
- `src-tauri/src/modules/account.rs`: Updated `get_data_dir()` and `save_account()`

## Known Limitations

1. **No automatic migration script**: Users must manually re-add accounts or run a future migration tool
2. **Desktop mode defaults to plain text**: For backward compatibility, encryption is opt-in on desktop
3. **No key rotation**: Changing `ANTIGRAVITY_MASTER_KEY` requires re-encrypting all accounts
4. **Memory safety**: Decrypted tokens exist in memory during runtime (mitigated by OS-level protections)

## Next Steps (Phase 2)

- [ ] Abstract `AppHandle` dependency in Web Admin
- [ ] Create `POST /api/v1/accounts` endpoint for adding accounts via API
- [ ] Create `DELETE /api/v1/accounts/:id` endpoint
- [ ] Create `ServiceContext` struct to decouple from Tauri
- [ ] Update Web Admin handlers to use `ServiceContext`

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTIGRAVITY_MASTER_KEY` | Server ✅<br>Desktop ❌ | - | Master encryption key (min 16 chars, recommend 32+) |
| `ANTIGRAVITY_DATA_DIR` | ❌ | `~/.antigravity_tools` | Custom data directory path |
| `ANTIGRAVITY_ENABLE_ENCRYPTION` | ❌ | `false` | Enable encryption in desktop mode |

## Success Criteria

- [x] Crypto module compiles in both desktop and server modes
- [x] EnvKeyring reads and validates `ANTIGRAVITY_MASTER_KEY`
- [x] SystemKeyring uses OS keyring (desktop mode only)
- [x] TokenData supports encrypted and plain-text tokens
- [x] Backward compatibility: old accounts load without errors
- [x] `get_data_dir()` respects `ANTIGRAVITY_DATA_DIR`
- [x] `save_account()` auto-encrypts in server mode
- [x] No breaking changes to existing desktop functionality

---

**Phase 1 Status**: ✅ **COMPLETE**
**Ready for**: Phase 2 - Web Admin Decoupling
