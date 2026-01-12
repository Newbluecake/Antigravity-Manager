use axum::{
    extract::Path,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::models::{Account, AccountSummary};
use crate::modules::account;
use crate::modules::web_admin::{Result, WebAdminError};

#[derive(Debug, Serialize)]
pub struct AccountListResponse {
    pub accounts: Vec<AccountSummary>,
    pub current_account_id: Option<String>,
}

/// GET /api/v1/accounts
pub async fn list_accounts() -> Result<Json<AccountListResponse>> {
    // We use the account module to get the list
    // Ideally we should just get summaries, but list_accounts loads full accounts
    // Let's use load_account_index directly if possible, or just map the result of list_accounts

    let index = account::load_account_index()
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(AccountListResponse {
        accounts: index.accounts,
        current_account_id: index.current_account_id,
    }))
}

/// GET /api/v1/accounts/:id
pub async fn get_account(
    Path(id): Path<String>,
) -> Result<Json<Account>> {
    let account = account::load_account(&id)
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(account))
}

/// POST /api/v1/accounts/:id/refresh
pub async fn refresh_account(
    Path(id): Path<String>,
) -> Result<Json<Account>> {
    let mut account = account::load_account(&id)
        .map_err(|e| WebAdminError::ServerError(e))?;

    // Use the fetch_quota_with_retry logic which handles token refresh and quota update
    let _quota = account::fetch_quota_with_retry(&mut account).await
        .map_err(|e| WebAdminError::ServerError(e.to_string()))?;

    // Reload account to get the latest state (saved by fetch_quota_with_retry)
    let updated_account = account::load_account(&id)
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(updated_account))
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountRequest {
    pub name: Option<String>,
    // Add other updateable fields here if needed
}

/// PATCH /api/v1/accounts/:id
pub async fn update_account(
    Path(id): Path<String>,
    Json(payload): Json<UpdateAccountRequest>,
) -> Result<Json<Account>> {
    let mut account = account::load_account(&id)
        .map_err(|e| WebAdminError::ServerError(e))?;

    if let Some(name) = payload.name {
        account.name = Some(name.clone());
        // We need to use upsert to update both file and index
        account::upsert_account(account.email.clone(), Some(name), account.token.clone())
            .map_err(|e| WebAdminError::ServerError(e))?;
    }

    let updated_account = account::load_account(&id)
        .map_err(|e| WebAdminError::ServerError(e))?;

    Ok(Json(updated_account))
}
