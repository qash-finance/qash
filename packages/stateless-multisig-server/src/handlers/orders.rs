use anyhow::Result as AnyhowResult;
use axum::{Json, extract::State, http::StatusCode};
use base64::{Engine as _, engine::general_purpose};
use miden_client::{
    Felt, Word,
    asset::FungibleAsset,
    note::{Note, NoteTag, NoteType},
};
use miden_objects::account::AccountId;
use miden_tx::utils::Serializable;
use serde::{Deserialize, Serialize};

use crate::state::AppState;
use crate::zoro::common::create_zoroswap_note;

// ============================================================================
// Request/Response Types
// ============================================================================

/// Request to submit a zoroswap order
///
/// The client specifies:
/// - Asset to swap from (faucet_id + amount)
/// - Asset to swap to (faucet_id + min_amount_out)
/// - Recipient account ID for the P2ID note
/// - Deadline for the swap
#[derive(Deserialize)]
pub struct SubmitOrderRequest {
    /// Account ID of the order creator (in bech32 format)
    pub account_id: String,

    /// Faucet ID of the input asset (hex string)
    pub faucet_id_in: String,

    /// Amount to swap from (in smallest units)
    pub amount_in: u64,

    /// Faucet ID of the output asset (hex string)
    pub faucet_id_out: String,

    /// Minimum amount of output asset expected (in smallest units)
    pub min_amount_out: u64,

    /// Recipient account ID that will receive the P2ID note (in bech32 format)
    pub recipient_account_id: String,

    /// Deadline timestamp in milliseconds (Unix time)
    pub deadline: u64,
}

#[derive(Serialize)]
pub struct SubmitOrderResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_id: Option<String>,

    /// The P2ID note returned by the Zoro server (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub p2id_note: Option<String>,
}

// ============================================================================
// Handler
// ============================================================================

/// Submit a zoroswap order
///
/// This handler follows the pattern from ref.rs:
/// STEP 4: Build a zoroswap note from order parameters
/// STEP 5: Send the serialized note to the Zoro AMM server
/// Returns: P2ID note from Zoro server (swapped assets or refund)
pub async fn submit_order(
    State(state): State<AppState>,
    Json(payload): Json<SubmitOrderRequest>,
) -> Result<Json<SubmitOrderResponse>, StatusCode> {
    tracing::info!(
        account_id = %payload.account_id,
        faucet_id_in = %payload.faucet_id_in,
        amount_in = payload.amount_in,
        "Received zoroswap order submission"
    );

    // =========================================================================
    // STEP 4: Create zoroswap note (from ref.rs STEP 4)
    // =========================================================================

    // Parse bech32 account IDs to AccountId
    let (_, account_id) = AccountId::from_bech32(&payload.account_id).map_err(|_| {
        tracing::error!("Invalid account_id format: {}", payload.account_id);
        StatusCode::BAD_REQUEST
    })?;

    let (_, recipient_account_id) =
        AccountId::from_bech32(&payload.recipient_account_id).map_err(|_| {
            tracing::error!(
                "Invalid recipient_account_id format: {}",
                payload.recipient_account_id
            );
            StatusCode::BAD_REQUEST
        })?;

    // Parse faucet IDs from bech32 strings
    let (_, faucet_id_in) = AccountId::from_bech32(&payload.faucet_id_in).map_err(|_| {
        tracing::error!("Invalid faucet_id_in format: {}", payload.faucet_id_in);
        StatusCode::BAD_REQUEST
    })?;

    let (_, faucet_id_out) = AccountId::from_bech32(&payload.faucet_id_out).map_err(|_| {
        tracing::error!("Invalid faucet_id_out format: {}", payload.faucet_id_out);
        StatusCode::BAD_REQUEST
    })?;

    // Create assets (following ref.rs STEP 4)
    let asset_in = FungibleAsset::new(faucet_id_in, payload.amount_in).map_err(|e| {
        tracing::error!("Failed to create input asset: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let asset_out = FungibleAsset::new(faucet_id_out, payload.min_amount_out).map_err(|e| {
        tracing::error!("Failed to create output asset: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Convert output asset to Word
    let requested_asset_word: Word = asset_out.into();

    // Create P2ID tag from recipient account ID
    let p2id_tag = NoteTag::from_account_id(recipient_account_id);

    // Build inputs array (like ref.rs STEP 4)
    let inputs = vec![
        requested_asset_word[0],
        requested_asset_word[1],
        requested_asset_word[2],
        requested_asset_word[3],
        Felt::new(payload.deadline), // deadline
        p2id_tag.into(),             // p2id tag
        Felt::new(0),
        Felt::new(0),
        Felt::new(0),
        Felt::new(0),
        recipient_account_id.suffix().into(), // recipient AccountID suffix
        recipient_account_id.prefix().into(), // recipient AccountID prefix
    ];

    // Get random serial number for the note (following ref.rs)
    let zoroswap_serial_num = state.client.get_random_word().await.map_err(|e| {
        tracing::error!("Failed to get random word: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Create the zoroswap note using the local create_zoroswap_note function
    let zoroswap_note = create_zoroswap_note(
        inputs,
        vec![asset_in.into()],
        account_id,
        zoroswap_serial_num,
        NoteTag::LocalAny(0),
        NoteType::Private,
    )
    .map_err(|e| {
        tracing::error!("Failed to create zoroswap note: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!(
        note_id = ?zoroswap_note.id(),
        "Zoroswap note created successfully"
    );

    // =========================================================================
    // STEP 5: Serialize and send note to Zoro AMM server
    // =========================================================================

    // Serialize the note using proper Miden serialization
    let serialized_note = serialize_note_to_base64(&zoroswap_note).map_err(|_| {
        tracing::error!("Failed to serialize zoroswap note");
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Get Zoro AMM endpoint from environment or state
    let zoro_amm_endpoint = std::env::var("ZORO_AMM_ENDPOINT")
        .unwrap_or_else(|_| "https://oracle.zoroswap.com".to_string());

    // Send to Zoro server for execution
    let order_id = format!("order_{}", uuid::Uuid::new_v4());
    let zoro_server_response = send_to_zoro_server(&zoro_amm_endpoint, serialized_note.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to send order to Zoro server: {}", e);
            StatusCode::BAD_GATEWAY
        })?;

    tracing::info!(
        order_id = %order_id,
        "Order submitted to Zoro server successfully"
    );

    // Return response with P2ID note from Zoro server
    Ok(Json(SubmitOrderResponse {
        success: true,
        message: "Order submitted successfully".to_string(),
        order_id: Some(order_id),
        p2id_note: Some(zoro_server_response),
    }))
}

// ============================================================================
// Serialization Helper
// ============================================================================

/// Serialize a Miden Note to base64-encoded bytes
fn serialize_note_to_base64(note: &Note) -> AnyhowResult<String> {
    let note_bytes: Vec<u8> = note.to_bytes();
    let encoded = general_purpose::STANDARD.encode(note_bytes);
    Ok(encoded)
}

// ============================================================================
// Zoro Server Communication
// ============================================================================

/// Send serialized note to Zoro AMM server and return P2ID note (following ref.rs STEP 5)
async fn send_to_zoro_server(server_url: &str, note: String) -> Result<String, String> {
    let url = format!("{}/orders/submit", server_url);

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&serde_json::json!({ "note_data": note }))
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Zoro server returned {}: {}", status, body));
    }

    // Parse response to extract P2ID note
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Failed to parse Zoro response: {}", e))?;

    let p2id_note = json
        .get("p2id_note")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "No p2id_note in Zoro server response".to_string())?
        .to_string();

    tracing::info!("Received P2ID note from Zoro server");

    Ok(p2id_note)
}
