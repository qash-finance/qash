use axum::{
    Router,
    routing::{get, post},
};

use crate::handlers::{health, multisig};
use crate::state::AppState;

pub fn create_routes() -> Router<AppState> {
    Router::new()
        // Health endpoints
        .route("/", get(health::root))
        .route("/health", get(health::health_check))
        // STATELESS Miden client endpoints - no data persistence
        // All account/proposal management is handled by the main server (qash-server)
        // Create multisig account via Miden client
        .route("/multisig/create-account", post(multisig::create_multisig))
        // Get consumable notes for an account
        .route(
            "/multisig/{account_id}/notes",
            get(multisig::get_consumable_notes),
        )
        // Get account balances
        .route(
            "/multisig/{account_id}/balances",
            get(multisig::get_account_balances),
        )
        // Mint tokens from faucet
        .route("/mint", post(multisig::mint_tokens))
        // Create transaction proposals (returns summary for signing)
        .route(
            "/multisig/consume-proposal",
            post(multisig::create_consume_proposal),
        )
        .route(
            "/multisig/send-proposal",
            post(multisig::create_send_proposal),
        )
        .route(
            "/multisig/batch-send-proposal",
            post(multisig::create_batch_send_proposal),
        )
        // Execute multisig transaction with signatures
        .route("/multisig/execute", post(multisig::execute_transaction))
}
