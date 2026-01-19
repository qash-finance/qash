use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub sync_height: u32,
}

pub async fn root() -> impl IntoResponse {
    Json(serde_json::json!({
        "message": "Para Multisig Server",
        "version": "0.1.0"
    }))
}

pub async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let sync_height = state
        .client
        .get_sync_height()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(HealthResponse {
        status: "ok".to_string(),
        sync_height,
    }))
}
