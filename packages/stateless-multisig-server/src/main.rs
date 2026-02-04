mod client;
mod handlers;
mod multisig;
mod multisig_auth;
mod routes;
mod state;
mod storage;
mod zoro;

use axum::Router;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "para_multisig_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Initializing Miden client...");

    // Initialize the global Miden client (runs in a separate thread due to !Send constraint)
    let app_state = AppState::new().await?;

    tracing::info!("Miden client initialized successfully");

    // Build the router
    let app = Router::new()
        .merge(routes::create_routes())
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(app_state);

    // Start the server
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3005);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
