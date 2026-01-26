use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};

use crate::multisig::public_keys_from_hex;
use crate::state::AppState;
use crate::storage::AssetInfo;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Deserialize)]
pub struct CreateMultisigRequest {
    pub threshold: u32,
    /// Original uncompressed public keys (65 bytes hex, starting with 04)
    /// These are needed for VM execution to verify signatures
    pub public_keys: Vec<String>,
}

#[derive(Serialize)]
pub struct CreateMultisigResponse {
    pub account_id: String,
}

#[derive(Serialize)]
pub struct GetNotesResponse {
    pub notes: Vec<NoteInfo>,
}

#[derive(Serialize)]
pub struct NoteInfo {
    pub note_id: String,
    pub assets: Vec<AssetInfo>,
    pub sender: Option<String>,
    pub note_type: String,
}

/// Request to create a consume notes proposal
#[derive(Deserialize)]
pub struct CreateConsumeProposalRequest {
    pub account_id: String,
    pub note_ids: Vec<String>,
}

/// Request to create a send transaction proposal
#[derive(Deserialize)]
pub struct CreateSendProposalRequest {
    pub account_id: String,
    pub recipient_id: String,
    pub faucet_id: String,
    pub amount: u64,
}

/// A single recipient in a batch payout
#[derive(Deserialize, Clone)]
pub struct BatchPayoutRecipient {
    pub recipient_id: String,
    pub faucet_id: String,
    pub amount: u64,
}

/// Request to create a batch payout proposal (multiple recipients in one transaction)
#[derive(Deserialize)]
pub struct CreateBatchSendProposalRequest {
    pub account_id: String,
    pub recipients: Vec<BatchPayoutRecipient>,
}

/// Request to mint tokens from a faucet
#[derive(Deserialize)]
pub struct MintRequest {
    /// The account ID to mint tokens to
    pub account_id: String,
    /// The faucet account ID
    pub faucet_id: String,
    /// Amount of tokens to mint
    pub amount: u64,
}

#[derive(Serialize)]
pub struct MintResponse {
    /// Transaction ID of the mint transaction
    pub transaction_id: String,
}

#[derive(Serialize)]
pub struct ProposeTransactionResponse {
    pub summary_commitment: String,
    pub summary_bytes_hex: String,
    pub request_bytes_hex: String,
}

#[derive(Serialize)]
pub struct ExecuteTransactionResponse {
    pub success: bool,
    pub transaction_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct AccountBalanceInfo {
    pub faucet_id: String,
    pub amount: u64,
}

#[derive(Serialize)]
pub struct GetBalancesResponse {
    pub balances: Vec<AccountBalanceInfo>,
}

// ============================================================================
// Handlers
// ============================================================================

/// POST /multisig/create-account - Create a new multisig account
/// STATELESS: Only creates the account via Miden client, returns the account_id
/// The caller (qash-server) is responsible for storing this in the database
pub async fn create_multisig(
    State(state): State<AppState>,
    Json(payload): Json<CreateMultisigRequest>,
) -> Result<Json<CreateMultisigResponse>, StatusCode> {
    // Parse original public keys (65 bytes uncompressed) and compute commitments
    let approvers = public_keys_from_hex(&payload.public_keys).map_err(|e| {
        tracing::error!("Failed to parse public keys: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Create the multisig account via the client command
    let account_id = state
        .client
        .create_multisig_account(approvers, payload.threshold)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create multisig account: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(CreateMultisigResponse { account_id }))
}

// Removed: get_account, list_accounts - these are now handled by qash-server via database queries

/// GET /multisig/:account_id/notes - Get consumable notes for an account
pub async fn get_consumable_notes(
    State(state): State<AppState>,
    Path(account_id): Path<String>,
) -> Result<Json<GetNotesResponse>, StatusCode> {
    // Note: sync_state is called inside get_consumable_notes implementation
    let notes = state
        .client
        .get_consumable_notes(account_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get consumable notes: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let notes: Vec<NoteInfo> = notes
        .into_iter()
        .map(|n| NoteInfo {
            note_id: n.note_id,
            assets: n.assets,
            sender: n.sender,
            note_type: n.note_type,
        })
        .collect();

    Ok(Json(GetNotesResponse { notes }))
}

/// POST /multisig/consume-proposal - Create a consume notes proposal
/// STATELESS: Creates the proposal via Miden client, returns the summary for signing
/// The caller is responsible for storing the proposal in the database
pub async fn create_consume_proposal(
    State(state): State<AppState>,
    Json(payload): Json<CreateConsumeProposalRequest>,
) -> Result<Json<ProposeTransactionResponse>, StatusCode> {
    // Create the consume proposal via client
    let result = state
        .client
        .create_consume_proposal(payload.account_id.clone(), payload.note_ids.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to create consume proposal: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(ProposeTransactionResponse {
        summary_commitment: result.summary_commitment,
        summary_bytes_hex: hex::encode(&result.summary_bytes),
        request_bytes_hex: hex::encode(&result.request_bytes),
    }))
}

/// POST /multisig/send-proposal - Create a send transaction proposal
/// STATELESS: Creates the proposal via Miden client, returns the summary for signing
pub async fn create_send_proposal(
    State(state): State<AppState>,
    Json(payload): Json<CreateSendProposalRequest>,
) -> Result<Json<ProposeTransactionResponse>, StatusCode> {
    // Create the send proposal via client
    let result = state
        .client
        .create_send_proposal(
            payload.account_id.clone(),
            payload.recipient_id,
            payload.faucet_id,
            payload.amount,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to create send proposal: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(ProposeTransactionResponse {
        summary_commitment: result.summary_commitment,
        summary_bytes_hex: hex::encode(&result.summary_bytes),
        request_bytes_hex: hex::encode(&result.request_bytes),
    }))
}

/// POST /multisig/batch-send-proposal - Create a batch payout proposal (multiple recipients)
/// STATELESS: Creates the proposal via Miden client, returns the summary for signing
/// The caller is responsible for storing the proposal in the database
pub async fn create_batch_send_proposal(
    State(state): State<AppState>,
    Json(payload): Json<CreateBatchSendProposalRequest>,
) -> Result<Json<ProposeTransactionResponse>, StatusCode> {
    // Validate we have at least one recipient
    if payload.recipients.is_empty() {
        tracing::error!("Batch send proposal has no recipients");
        return Err(StatusCode::BAD_REQUEST);
    }

    // Create the batch send proposal via client
    let result = state
        .client
        .create_batch_send_proposal(payload.account_id.clone(), payload.recipients.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to create batch send proposal: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(ProposeTransactionResponse {
        summary_commitment: result.summary_commitment,
        summary_bytes_hex: hex::encode(&result.summary_bytes),
        request_bytes_hex: hex::encode(&result.request_bytes),
    }))
}

// Removed: list_proposals, get_proposal, submit_signature - these are now handled by the database layer

/// Request to execute a multisig transaction
#[derive(Deserialize)]
pub struct ExecuteTransactionRequest {
    pub account_id: String,
    pub request_bytes_hex: String,
    pub summary_bytes_hex: String,
    pub signatures_hex: Vec<Option<String>>, // Indexed by approver position
    pub public_keys_hex: Vec<String>,        // Original public keys
}

/// POST /multisig/execute - Execute a multisig transaction with signatures
/// STATELESS: Executes the transaction via Miden client
pub async fn execute_transaction(
    State(state): State<AppState>,
    Json(payload): Json<ExecuteTransactionRequest>,
) -> Result<Json<ExecuteTransactionResponse>, StatusCode> {
    // Decode hex strings to bytes
    let request_bytes = hex::decode(&payload.request_bytes_hex).map_err(|e| {
        tracing::error!("Failed to decode request_bytes_hex: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    let summary_bytes = hex::decode(&payload.summary_bytes_hex).map_err(|e| {
        tracing::error!("Failed to decode summary_bytes_hex: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Execute the multisig transaction
    match state
        .client
        .execute_multisig_transaction(
            payload.account_id.clone(),
            request_bytes,
            summary_bytes,
            payload.signatures_hex,
            payload.public_keys_hex,
        )
        .await
    {
        Ok(tx_id) => Ok(Json(ExecuteTransactionResponse {
            success: true,
            transaction_id: Some(tx_id),
            error: None,
        })),
        Err(e) => {
            tracing::error!("Failed to execute multisig transaction: {}", e);
            Ok(Json(ExecuteTransactionResponse {
                success: false,
                transaction_id: None,
                error: Some(e),
            }))
        }
    }
}

/// GET /multisig/:account_id/balances - Get account balances (assets)
pub async fn get_account_balances(
    State(state): State<AppState>,
    Path(account_id): Path<String>,
) -> Result<Json<GetBalancesResponse>, StatusCode> {
    let balances = state
        .client
        .get_account_balances(account_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get account balances: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let balances: Vec<AccountBalanceInfo> = balances
        .into_iter()
        .map(|b| AccountBalanceInfo {
            faucet_id: b.faucet_id,
            amount: b.amount,
        })
        .collect();

    Ok(Json(GetBalancesResponse { balances }))
}

/// POST /mint - Mint tokens from a faucet
/// Creates a mint transaction and executes it immediately (no multisig approval needed)
pub async fn mint_tokens(
    State(state): State<AppState>,
    Json(payload): Json<MintRequest>,
) -> Result<Json<MintResponse>, StatusCode> {
    let tx_id = state
        .client
        .mint_tokens(
            payload.account_id.clone(),
            payload.faucet_id,
            payload.amount,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to mint tokens: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(MintResponse {
        transaction_id: tx_id,
    }))
}

// All helper functions removed - stateless server needs no helpers
