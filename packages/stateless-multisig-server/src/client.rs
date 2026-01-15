use miden_client::{
    builder::ClientBuilder, keystore::FilesystemKeyStore, rpc::Endpoint, rpc::GrpcClient,
    note_transport::{grpc::GrpcNoteTransportClient, NOTE_TRANSPORT_DEFAULT_ENDPOINT},
    Client as MidenClient, ClientError, DebugMode,
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use rand::rngs::StdRng;
use std::sync::Arc;

/// Type alias for the Miden client with filesystem keystore
pub type Client = MidenClient<FilesystemKeyStore<StdRng>>;

/// Creates and initializes a new Miden client
pub async fn create_client(endpoint: Endpoint) -> Result<Client, ClientError> {
    let timeout_ms = 10_000;
    let rpc_client = Arc::new(GrpcClient::new(&endpoint, timeout_ms));

    // Connect to the note transport layer for private note exchange
    let note_transport = GrpcNoteTransportClient::connect(
        NOTE_TRANSPORT_DEFAULT_ENDPOINT.to_string(),
        timeout_ms,
    )
    .await
    .map_err(|e| {
        tracing::warn!("Failed to connect to note transport: {:?}", e);
        e
    })?;

    let client = ClientBuilder::new()
        .rpc(rpc_client)
        .sqlite_store("store.sqlite3".into())
        .filesystem_keystore("./keystore")
        .in_debug_mode(DebugMode::Enabled)
        .note_transport(Arc::new(note_transport))
        .build()
        .await?;

    Ok(client)
}

/// Creates a client connected to testnet
pub async fn create_testnet_client() -> Result<Client, ClientError> {
    create_client(Endpoint::testnet()).await
}

/// Creates a client connected to devnet
#[allow(dead_code)]
pub async fn create_devnet_client() -> Result<Client, ClientError> {
    create_client(Endpoint::devnet()).await
}
