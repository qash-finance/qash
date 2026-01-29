use miden_client::address::NetworkId;
use miden_client::rpc::Endpoint;
use miden_objects::account::auth::PublicKeyCommitment;
use tokio::sync::{mpsc, oneshot};

use crate::client::create_client;
use crate::multisig::MultisigOps;
use crate::storage::ConsumableNoteInfo;

/// Serializable note info for client communication
#[derive(Debug, Clone)]
pub struct NoteInfoResponse {
    pub note_id: String,
    pub assets: Vec<(String, u64)>, // (faucet_id, amount)
    pub sender: Option<String>,
}

/// Result of creating a multisig transaction proposal (for both consume and send)
#[derive(Debug, Clone)]
pub struct ProposalResult {
    pub summary_commitment: String,
    pub summary_bytes: Vec<u8>,
    pub request_bytes: Vec<u8>,
}

/// Commands that can be sent to the Miden client task
pub enum ClientCommand {
    GetSyncHeight {
        respond_to: oneshot::Sender<Result<u32, String>>,
    },
    SyncState {
        respond_to: oneshot::Sender<Result<(), String>>,
    },
    CreateMultisigAccount {
        approvers: Vec<PublicKeyCommitment>,
        threshold: u32,
        respond_to: oneshot::Sender<Result<String, String>>,
    },
    GetConsumableNotes {
        account_id: String,
        respond_to: oneshot::Sender<Result<Vec<ConsumableNoteInfo>, String>>,
    },
    /// Create a consume notes proposal (for multisig - returns summary for signing)
    CreateConsumeProposal {
        account_id: String,
        note_ids: Vec<String>,
        respond_to: oneshot::Sender<Result<ProposalResult, String>>,
    },
    /// Create a send transaction proposal (for multisig - returns summary for signing)
    CreateSendProposal {
        account_id: String,
        recipient_id: String,
        faucet_id: String,
        amount: u64,
        respond_to: oneshot::Sender<Result<ProposalResult, String>>,
    },
    /// Create a batch send proposal (multiple recipients in one transaction)
    CreateBatchSendProposal {
        account_id: String,
        recipients: Vec<crate::handlers::multisig::BatchPayoutRecipient>,
        respond_to: oneshot::Sender<Result<ProposalResult, String>>,
    },
    /// Execute a multisig transaction with collected signatures
    ExecuteMultisigTransaction {
        account_id: String,
        request_bytes: Vec<u8>,
        summary_bytes: Vec<u8>,
        signatures_hex: Vec<Option<String>>, // Hex-encoded signatures indexed by approver position
        public_keys_hex: Vec<String>,        // Original public keys for advice map
        respond_to: oneshot::Sender<Result<String, String>>, // Returns transaction ID
    },
    /// Get account balances (assets)
    GetAccountBalances {
        account_id: String,
        respond_to: oneshot::Sender<Result<Vec<AccountAsset>, String>>,
    },
    /// Mint tokens from a faucet
    MintTokens {
        account_id: String,
        faucet_id: String,
        amount: u64,
        respond_to: oneshot::Sender<Result<String, String>>, // Returns transaction ID
    },
}

/// Represents an asset balance in an account
#[derive(Debug, Clone)]
pub struct AccountAsset {
    pub faucet_id: String,
    pub amount: u64,
}

/// Handle to send commands to the Miden client
#[derive(Clone)]
pub struct ClientHandle {
    sender: mpsc::Sender<ClientCommand>,
}

impl ClientHandle {
    pub async fn get_sync_height(&self) -> Result<u32, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::GetSyncHeight { respond_to: tx })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn sync_state(&self) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::SyncState { respond_to: tx })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn create_multisig_account(
        &self,
        approvers: Vec<PublicKeyCommitment>,
        threshold: u32,
    ) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::CreateMultisigAccount {
                approvers,
                threshold,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn get_consumable_notes(
        &self,
        account_id: String,
    ) -> Result<Vec<ConsumableNoteInfo>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::GetConsumableNotes {
                account_id,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn create_consume_proposal(
        &self,
        account_id: String,
        note_ids: Vec<String>,
    ) -> Result<ProposalResult, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::CreateConsumeProposal {
                account_id,
                note_ids,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn create_send_proposal(
        &self,
        account_id: String,
        recipient_id: String,
        faucet_id: String,
        amount: u64,
    ) -> Result<ProposalResult, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::CreateSendProposal {
                account_id,
                recipient_id,
                faucet_id,
                amount,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn create_batch_send_proposal(
        &self,
        account_id: String,
        recipients: Vec<crate::handlers::multisig::BatchPayoutRecipient>,
    ) -> Result<ProposalResult, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::CreateBatchSendProposal {
                account_id,
                recipients,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn execute_multisig_transaction(
        &self,
        account_id: String,
        request_bytes: Vec<u8>,
        summary_bytes: Vec<u8>,
        signatures_hex: Vec<Option<String>>,
        public_keys_hex: Vec<String>,
    ) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::ExecuteMultisigTransaction {
                account_id,
                request_bytes,
                summary_bytes,
                signatures_hex,
                public_keys_hex,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn get_account_balances(
        &self,
        account_id: String,
    ) -> Result<Vec<AccountAsset>, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::GetAccountBalances {
                account_id,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }

    pub async fn mint_tokens(
        &self,
        account_id: String,
        faucet_id: String,
        amount: u64,
    ) -> Result<String, String> {
        let (tx, rx) = oneshot::channel();
        self.sender
            .send(ClientCommand::MintTokens {
                account_id,
                faucet_id,
                amount,
                respond_to: tx,
            })
            .await
            .map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    }
}

/// Application state that holds the handle to the Miden client
/// This is stateless - all data persistence is handled by the main qash-server
#[derive(Clone)]
pub struct AppState {
    pub client: ClientHandle,
}

impl AppState {
    /// Creates a new AppState with an initialized Miden client.
    /// The Miden client runs in a dedicated thread with its own tokio runtime
    /// because the client is !Send.
    pub async fn new() -> anyhow::Result<Self> {
        // Create channel for communication
        let (tx, rx) = mpsc::channel::<ClientCommand>(32);

        // Use a oneshot to get the initial sync height back
        let (init_tx, init_rx) = oneshot::channel::<Result<u32, String>>();

        // Spawn a dedicated thread for the Miden client
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async move {
                // Create and initialize client in this thread
                let mut client = match create_client(Endpoint::testnet()).await {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = init_tx.send(Err(e.to_string()));
                        return;
                    }
                };

                // Sync state on startup
                if let Err(e) = client.sync_state().await {
                    let _ = init_tx.send(Err(e.to_string()));
                    return;
                }

                // Get initial sync height
                let sync_height = match client.get_sync_height().await {
                    Ok(h) => h,
                    Err(e) => {
                        let _ = init_tx.send(Err(e.to_string()));
                        return;
                    }
                };

                // Send success signal with sync height (BlockNumber is u32 wrapper)
                let _ = init_tx.send(Ok(sync_height.as_u32()));

                // Run the command loop
                run_client_loop(client, rx).await;
            });
        });

        // Wait for initialization to complete
        let sync_height = init_rx
            .await
            .map_err(|e| anyhow::anyhow!("Channel error: {}", e))?
            .map_err(|e| anyhow::anyhow!("Client error: {}", e))?;
        tracing::info!("Miden client synced to height: {}", sync_height);

        Ok(Self {
            client: ClientHandle { sender: tx },
        })
    }
}

/// Runs the Miden client command loop
async fn run_client_loop(
    mut client: crate::client::Client,
    mut receiver: mpsc::Receiver<ClientCommand>,
) {
    while let Some(cmd) = receiver.recv().await {
        match cmd {
            ClientCommand::GetSyncHeight { respond_to } => {
                let result = client.get_sync_height().await;
                let mapped = result.map(|h| h.as_u32()).map_err(|e| e.to_string());
                let _ = respond_to.send(mapped);
            }
            ClientCommand::SyncState { respond_to } => {
                let result = client.sync_state().await;
                let mapped = result.map(|_| ()).map_err(|e| e.to_string());
                let _ = respond_to.send(mapped);
            }
            ClientCommand::CreateMultisigAccount {
                approvers,
                threshold,
                respond_to,
            } => {
                use miden_objects::address::{
                    Address, AddressInterface, NetworkId, RoutingParameters,
                };
                let result = MultisigOps::setup_account(&mut client, approvers, threshold).await;
                let mapped = result
                    .map(|account| {
                        // Create full Address with routing parameters for proper note receiving
                        let routing_params = RoutingParameters::new(AddressInterface::BasicWallet);
                        match Address::new(account.id()).with_routing_parameters(routing_params) {
                            Ok(address) => address.encode(NetworkId::Testnet),
                            Err(_) => {
                                // Fallback to just account ID if routing params fail
                                account.id().to_bech32(NetworkId::Testnet)
                            }
                        }
                    })
                    .map_err(|e| e.to_string());
                let _ = respond_to.send(mapped);
            }
            ClientCommand::GetConsumableNotes {
                account_id,
                respond_to,
            } => {
                let result = get_consumable_notes_impl(&mut client, &account_id).await;
                let _ = respond_to.send(result);
            }
            ClientCommand::CreateConsumeProposal {
                account_id,
                note_ids,
                respond_to,
            } => {
                let result = create_consume_proposal_impl(&mut client, &account_id, note_ids).await;
                let _ = respond_to.send(result);
            }
            ClientCommand::CreateSendProposal {
                account_id,
                recipient_id,
                faucet_id,
                amount,
                respond_to,
            } => {
                let result = create_send_proposal_impl(
                    &mut client,
                    &account_id,
                    &recipient_id,
                    &faucet_id,
                    amount,
                )
                .await;
                let _ = respond_to.send(result);
            }
            ClientCommand::CreateBatchSendProposal {
                account_id,
                recipients,
                respond_to,
            } => {
                let result =
                    create_batch_send_proposal_impl(&mut client, &account_id, recipients).await;
                let _ = respond_to.send(result);
            }
            ClientCommand::ExecuteMultisigTransaction {
                account_id,
                request_bytes,
                summary_bytes,
                signatures_hex,
                public_keys_hex,
                respond_to,
            } => {
                let result = execute_multisig_transaction_impl(
                    &mut client,
                    &account_id,
                    request_bytes,
                    summary_bytes,
                    signatures_hex,
                    public_keys_hex,
                )
                .await;
                let _ = respond_to.send(result);
            }
            ClientCommand::GetAccountBalances {
                account_id,
                respond_to,
            } => {
                let result = get_account_balances_impl(&mut client, &account_id).await;
                let _ = respond_to.send(result);
            }
            ClientCommand::MintTokens {
                account_id,
                faucet_id,
                amount,
                respond_to,
            } => {
                let result = mint_tokens_impl(&mut client, &account_id, &faucet_id, amount).await;
                let _ = respond_to.send(result);
            }
        }
    }
}

/// Implementation of getting consumable notes for an account
async fn get_consumable_notes_impl(
    client: &mut crate::client::Client,
    account_id_str: &str,
) -> Result<Vec<ConsumableNoteInfo>, String> {
    use crate::storage::AssetInfo;
    use miden_objects::address::NetworkId;

    tracing::debug!("Parsing account ID: {}", account_id_str);

    // Use the helper that handles full address format (strips routing params)
    let account_id = parse_account_id(account_id_str)?;

    tracing::debug!("Successfully parsed account ID: {:?}", account_id);

    // Sync state before getting notes
    client
        .sync_state()
        .await
        .map_err(|e| format!("Failed to sync state: {}", e))?;

    tracing::debug!("State synced, fetching consumable notes");

    // Get consumable notes from client
    let consumable_notes = client
        .get_consumable_notes(Some(account_id))
        .await
        .map_err(|e| format!("Failed to get consumable notes: {}", e))?;

    // print out all consumable notes
    // tracing::debug!("Consumable notes {:?}", consumable_notes);

    // Convert to our info format
    // The return type is Vec<(InputNoteRecord, Vec<(AccountId, NoteRelevance)>)>
    let notes: Vec<ConsumableNoteInfo> = consumable_notes
        .into_iter()
        .map(|(note_record, _relevance)| {
            let note_id = note_record.id().to_string();

            // Extract assets from the note
            let assets: Vec<AssetInfo> = note_record
                .assets()
                .iter()
                .map(|asset| {
                    // For fungible assets
                    if asset.is_fungible() {
                        let fungible = asset.unwrap_fungible();
                        AssetInfo {
                            faucet_id: fungible.faucet_id().to_bech32(NetworkId::Testnet),
                            amount: fungible.amount(),
                        }
                    } else {
                        let non_fungible = asset.unwrap_non_fungible();
                        AssetInfo {
                            faucet_id: non_fungible.faucet_id_prefix().to_string(),
                            amount: 1, // Non-fungible
                        }
                    }
                })
                .collect();

            // Get sender if available from note metadata
            let sender = note_record
                .metadata()
                .map(|m| m.sender().to_bech32(NetworkId::Testnet));

            ConsumableNoteInfo {
                note_id,
                assets,
                sender,
                note_type: format!("{:?}", note_record.metadata().map(|m| m.note_type())),
            }
        })
        .collect();

    Ok(notes)
}

/// Helper to parse account ID from string (supports full address, bech32, and hex)
/// Full address format: mtst1<account_id>_<routing_params> (e.g., mtst1abc123..._qpgqqwcfx0p)
/// This function strips routing parameters if present
fn parse_account_id(account_id_str: &str) -> Result<miden_client::account::AccountId, String> {
    use miden_client::account::AccountId;

    // Strip routing parameters if present (everything after underscore)
    let account_part = if let Some(underscore_pos) = account_id_str.find('_') {
        &account_id_str[..underscore_pos]
    } else {
        account_id_str
    };

    if account_part.starts_with("mtst1")
        || account_part.starts_with("mm1")
        || account_part.starts_with("mdev1")
    {
        AccountId::from_bech32(account_part)
            .map(|(_, id)| id)
            .map_err(|e| format!("Invalid bech32 account ID: {:?}", e))
    } else {
        AccountId::from_hex(account_part).map_err(|e| format!("Invalid hex account ID: {:?}", e))
    }
}

/// Implementation of creating a consume notes proposal (for multisig)
async fn create_consume_proposal_impl(
    client: &mut crate::client::Client,
    account_id_str: &str,
    note_id_strs: Vec<String>,
) -> Result<ProposalResult, String> {
    use miden_client::note::NoteId;
    use miden_client::transaction::TransactionRequestBuilder;
    use miden_objects::utils::Serializable;

    tracing::debug!("Creating consume proposal for account: {}", account_id_str);

    let account_id = parse_account_id(account_id_str)?;

    // Sync state before creating proposal
    client
        .sync_state()
        .await
        .map_err(|e| format!("Failed to sync state: {}", e))?;

    // Parse note IDs - NoteId::try_from_hex expects the full hex string with 0x prefix
    let note_ids: Vec<NoteId> = note_id_strs
        .iter()
        .map(|s| {
            // Ensure the note ID has the 0x prefix
            let hex_str = if s.starts_with("0x") || s.starts_with("0X") {
                s.clone()
            } else {
                format!("0x{}", s)
            };
            NoteId::try_from_hex(&hex_str).map_err(|e| format!("Invalid note ID {}: {:?}", s, e))
        })
        .collect::<Result<Vec<_>, _>>()?;

    tracing::debug!(
        "Creating proposal to consume {} notes: {:?}",
        note_ids.len(),
        note_ids
    );

    // Build consume notes transaction request
    tracing::debug!("Building consume notes transaction request...");
    let tx_request = TransactionRequestBuilder::new()
        .build_consume_notes(note_ids.clone())
        .map_err(|e| {
            tracing::error!("Failed to build consume notes request: {:?}", e);
            format!("Failed to build consume notes request: {:?}", e)
        })?;
    tracing::debug!("Transaction request built successfully");

    // For multisig, we need to propose the transaction and get the summary
    // This will fail with Unauthorized error which contains the TransactionSummary
    tracing::debug!("Proposing transaction for account: {:?}", account_id);
    let result =
        crate::multisig::MultisigOps::propose_transaction(client, account_id, tx_request.clone())
            .await;

    match result {
        Ok(summary) => {
            // Get summary commitment as hex string
            let commitment = summary.to_commitment();

            let summary_commitment = commitment.to_hex();

            // Serialize using miden's native serialization
            let summary_bytes = summary.to_bytes();
            let request_bytes = tx_request.to_bytes();

            tracing::info!(
                "Consume proposal created with commitment: {}",
                summary_commitment
            );

            Ok(ProposalResult {
                summary_commitment,
                summary_bytes,
                request_bytes,
            })
        }
        Err(e) => {
            tracing::error!("Failed to create consume proposal: {:?}", e);
            Err(format!("Failed to create consume proposal: {:?}", e))
        }
    }
}

/// Implementation of creating a send transaction proposal (for multisig)
async fn create_send_proposal_impl(
    client: &mut crate::client::Client,
    account_id_str: &str,
    recipient_id_str: &str,
    faucet_id_str: &str,
    amount: u64,
) -> Result<ProposalResult, String> {
    use miden_client::note::NoteType;
    use miden_client::transaction::{PaymentNoteDescription, TransactionRequestBuilder};
    use miden_objects::asset::FungibleAsset;

    tracing::debug!(
        "Creating send proposal: {} -> {} ({} from faucet {})",
        account_id_str,
        recipient_id_str,
        amount,
        faucet_id_str
    );

    let sender_id = parse_account_id(account_id_str)?;
    let recipient_id = parse_account_id(recipient_id_str)?;
    let faucet_id = parse_account_id(faucet_id_str)?;

    // Sync state
    client
        .sync_state()
        .await
        .map_err(|e| format!("Failed to sync state: {}", e))?;

    // Create the fungible asset
    let asset = FungibleAsset::new(faucet_id, amount)
        .map_err(|e| format!("Failed to create asset: {:?}", e))?;

    // Build payment description
    let payment = PaymentNoteDescription::new(vec![asset.into()], sender_id, recipient_id);

    // Build the transaction request
    let tx_request = TransactionRequestBuilder::new()
        .build_pay_to_id(payment, NoteType::Public, client.rng())
        .map_err(|e| format!("Failed to build pay_to_id request: {:?}", e))?;

    // For multisig, we need to propose the transaction and get the summary
    // This will fail with Unauthorized error which contains the TransactionSummary
    let result =
        crate::multisig::MultisigOps::propose_transaction(client, sender_id, tx_request.clone())
            .await;

    match result {
        Ok(summary) => {
            use miden_objects::utils::Serializable;

            // Get summary commitment as hex string
            let commitment = summary.to_commitment();
            let summary_commitment = format!(
                "0x{}",
                commitment
                    .iter()
                    .map(|f| format!("{:016x}", f.as_int()))
                    .collect::<Vec<_>>()
                    .join("")
            );

            // Serialize using miden's native serialization
            let summary_bytes = summary.to_bytes();
            let request_bytes = tx_request.to_bytes();

            Ok(ProposalResult {
                summary_commitment,
                summary_bytes,
                request_bytes,
            })
        }
        Err(e) => Err(format!("Failed to create proposal: {:?}", e)),
    }
}

/// Implementation of creating a batch send proposal (multiple recipients in one transaction)
async fn create_batch_send_proposal_impl(
    client: &mut crate::client::Client,
    account_id_str: &str,
    recipients: Vec<crate::handlers::multisig::BatchPayoutRecipient>,
) -> Result<ProposalResult, String> {
    use miden_client::note::{NoteType, create_p2id_note};
    use miden_client::transaction::{OutputNote, TransactionRequestBuilder};
    use miden_objects::asset::FungibleAsset;
    use miden_objects::utils::Serializable;

    tracing::debug!(
        "Creating batch send proposal for {} recipients from account {}",
        recipients.len(),
        account_id_str
    );

    let sender_id = parse_account_id(account_id_str)?;

    // Sync state
    client
        .sync_state()
        .await
        .map_err(|e| format!("Failed to sync state: {}", e))?;

    // Create P2ID notes for each recipient
    let mut output_notes: Vec<OutputNote> = Vec::new();

    for (idx, recipient) in recipients.iter().enumerate() {
        let recipient_id = parse_account_id(&recipient.recipient_id)?;
        let faucet_id = parse_account_id(&recipient.faucet_id)?;

        // Create the fungible asset
        let asset = FungibleAsset::new(faucet_id, recipient.amount)
            .map_err(|e| format!("Failed to create asset for recipient {}: {:?}", idx, e))?;

        // Create P2ID note for this recipient
        let note = create_p2id_note(
            sender_id,
            recipient_id,
            vec![asset.into()],
            NoteType::Public,
            Default::default(),
            client.rng(),
        )
        .map_err(|e| format!("Failed to create P2ID note for recipient {}: {:?}", idx, e))?;

        output_notes.push(OutputNote::Full(note));

        tracing::debug!(
            "Created P2ID note {} for recipient {} ({} to {})",
            idx,
            recipient.recipient_id,
            recipient.amount,
            recipient.faucet_id
        );
    }

    // Build the transaction request with all output notes
    let tx_request = TransactionRequestBuilder::new()
        .own_output_notes(output_notes)
        .build()
        .map_err(|e| format!("Failed to build batch transaction request: {:?}", e))?;

    // For multisig, we need to propose the transaction and get the summary
    let result =
        crate::multisig::MultisigOps::propose_transaction(client, sender_id, tx_request.clone())
            .await;

    match result {
        Ok(summary) => {
            let commitment = summary.to_commitment();

            let summary_commitment = commitment.to_hex();

            // Serialize using miden's native serialization
            let summary_bytes = summary.to_bytes();
            let request_bytes = tx_request.to_bytes();

            tracing::info!(
                "Consume proposal created with commitment: {}",
                summary_commitment
            );

            Ok(ProposalResult {
                summary_commitment,
                summary_bytes,
                request_bytes,
            })
        }
        Err(e) => Err(format!("Failed to create batch send proposal: {:?}", e)),
    }
}

/// Implementation of executing a multisig transaction with collected signatures
async fn execute_multisig_transaction_impl(
    client: &mut crate::client::Client,
    account_id_str: &str,
    request_bytes: Vec<u8>,
    summary_bytes: Vec<u8>,
    signatures_hex: Vec<Option<String>>,
    public_keys_hex: Vec<String>,
) -> Result<String, String> {
    use miden_client::transaction::TransactionRequest;
    use miden_client::{Felt, Word, ZERO};
    use miden_objects::Hasher;
    use miden_objects::transaction::TransactionSummary;
    use miden_objects::utils::Deserializable;

    tracing::debug!(
        "Executing multisig transaction for account: {}",
        account_id_str
    );

    let account_id = parse_account_id(account_id_str)?;

    // Sync state before executing
    client
        .sync_state()
        .await
        .map_err(|e| format!("Failed to sync state: {}", e))?;

    // Deserialize the transaction request and summary
    tracing::debug!(
        "Deserializing transaction request ({} bytes)",
        request_bytes.len()
    );
    let mut tx_request = TransactionRequest::read_from_bytes(&request_bytes)
        .map_err(|e| format!("Failed to deserialize transaction request: {:?}", e))?;

    tracing::debug!(
        "Deserializing transaction summary ({} bytes)",
        summary_bytes.len()
    );
    let summary = TransactionSummary::read_from_bytes(&summary_bytes)
        .map_err(|e| format!("Failed to deserialize transaction summary: {:?}", e))?;

    // Get the account to access storage for public keys
    let account = client
        .get_account(account_id)
        .await
        .map_err(|e| format!("Failed to get account: {:?}", e))?
        .ok_or_else(|| format!("Account not found: {}", account_id_str))?;

    // Add signatures to the advice provider
    let advice_inputs = tx_request.advice_map_mut();
    let msg = summary.to_commitment();

    // Get number of approvers from storage slot 0
    let num_approvers: u32 = account
        .account()
        .storage()
        .get_item(0)
        .map_err(|e| format!("Failed to get storage item 0: {:?}", e))?
        .as_elements()[1]
        .try_into()
        .map_err(|_| "Failed to convert num_approvers to u32".to_string())?;

    tracing::debug!(
        "Account has {} approvers, adding signatures to advice map",
        num_approvers
    );
    tracing::debug!("Transaction summary commitment (msg): {:?}", msg);

    // Log public keys for debugging
    tracing::debug!("Received {} public keys", public_keys_hex.len());
    for (i, pk_hex) in public_keys_hex.iter().enumerate() {
        tracing::debug!(
            "Public key {} hex (first 20 chars): {}...",
            i,
            &pk_hex[..pk_hex.len().min(20)]
        );
    }

    for i in 0..num_approvers as usize {
        let pub_key_index_word = Word::from([Felt::from(i as u32), ZERO, ZERO, ZERO]);
        tracing::debug!(
            "Looking up public key commitment at index word: {:?}",
            pub_key_index_word
        );

        let pub_key_commitment = account
            .account()
            .storage()
            .get_map_item(1, pub_key_index_word)
            .map_err(|e| format!("Failed to get public key for approver {}: {:?}", i, e))?;

        tracing::debug!(
            "Public key commitment for approver {}: {:?}",
            i,
            pub_key_commitment
        );

        // Compute the signature key from pub_key_commitment and message
        let sig_key = Hasher::merge(&[pub_key_commitment, msg]);
        tracing::debug!("Signature key for approver {}: {:?}", i, sig_key);

        if let Some(sig_hex) = signatures_hex.get(i).and_then(|s| s.as_ref()) {
            // Parse hex signature to bytes
            let sig_bytes = hex::decode(sig_hex.trim_start_matches("0x"))
                .map_err(|e| format!("Failed to decode signature hex for approver {}: {}", i, e))?;

            tracing::debug!(
                "Signature bytes for approver {} ({} bytes): {:?}",
                i,
                sig_bytes.len(),
                &sig_bytes[..sig_bytes.len().min(20)]
            );

            // The signature from Para comes with:
            // - Byte 0: auth scheme prefix (1 = ECDSA)
            // - Bytes 1-65: r (32) + s (32) + v (1)
            // - Byte 66: padding byte (0)
            //
            // Miden's EcdsaSignature::read_from expects 66 bytes:
            // - r (32 bytes) + s (32 bytes) + v (1 byte) + padding (1 byte)
            //
            // So we need to extract bytes 1..67 (66 bytes total including the padding)
            if sig_bytes.len() < 67 {
                return Err(format!(
                    "Signature too short for approver {}: expected at least 67 bytes, got {}",
                    i,
                    sig_bytes.len()
                ));
            }

            // Verify auth scheme prefix
            if sig_bytes[0] != 1 {
                return Err(format!(
                    "Invalid auth scheme prefix for approver {}: expected 1 (ECDSA), got {}",
                    i, sig_bytes[0]
                ));
            }

            // Extract the raw ECDSA signature (r, s, v, padding) - 66 bytes starting at index 1
            let raw_sig_bytes = &sig_bytes[1..67];

            tracing::debug!(
                "Raw ECDSA signature bytes for approver {} ({} bytes): r={:?}, s={:?}, v={}, padding={}",
                i,
                raw_sig_bytes.len(),
                &raw_sig_bytes[0..8],   // First 8 bytes of r
                &raw_sig_bytes[32..40], // First 8 bytes of s
                raw_sig_bytes[64],      // v
                raw_sig_bytes[65]       // padding
            );

            // Parse as ECDSA signature
            // Miden format: r (32 bytes big-endian) + s (32 bytes big-endian) + v (1 byte) + padding (1 byte)
            use miden_objects::crypto::dsa::ecdsa_k256_keccak::Signature as ObjectsEcdsaSignature;
            use miden_objects::utils::Deserializable;

            let ecdsa_sig = ObjectsEcdsaSignature::read_from_bytes(raw_sig_bytes).map_err(|e| {
                format!(
                    "Failed to parse ECDSA signature for approver {}: {:?}",
                    i, e
                )
            })?;

            // Wrap in the Signature enum and prepare for the VM
            use miden_objects::account::auth::Signature;
            let signature = Signature::EcdsaK256Keccak(ecdsa_sig);

            // Use to_prepared_signature which properly formats the signature for the VM
            // This includes the public key recovery and proper Felt formatting
            let prepared_sig = signature.to_prepared_signature(msg);

            tracing::debug!(
                "Adding prepared signature for approver {} with {} felts",
                i,
                prepared_sig.len()
            );
            advice_inputs.extend(vec![(sig_key, prepared_sig)]);
        } else {
            tracing::debug!("No signature provided for approver {}", i);
        }
    }

    // Execute the transaction
    tracing::debug!("Submitting multisig transaction");
    let tx_id = client
        .submit_new_transaction(account_id, tx_request)
        .await
        .map_err(|e| format!("Failed to execute multisig transaction: {:?}", e))?;

    tracing::info!("Multisig transaction executed successfully, ID: {}", tx_id);

    Ok(tx_id.to_string())
}

/// Parse an ECDSA K256 public key from hex string (compressed or uncompressed format)
fn parse_public_key_from_hex(
    hex_str: &str,
) -> Result<miden_crypto::dsa::ecdsa_k256_keccak::PublicKey, String> {
    use miden_crypto::dsa::ecdsa_k256_keccak::PublicKey as EcdsaPublicKey;
    use miden_crypto::utils::Deserializable;

    // Remove "0x" prefix if present
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);

    // Decode hex to bytes
    let key_bytes = hex::decode(hex_str).map_err(|e| format!("Invalid hex: {}", e))?;

    let compressed_bytes = if key_bytes.len() == 65 && key_bytes[0] == 0x04 {
        // Convert uncompressed to compressed format
        // Compressed format: 0x02 or 0x03 prefix (based on y-coordinate parity) + x-coordinate
        let x = &key_bytes[1..33];
        let y = &key_bytes[33..65];

        // Determine prefix: 0x02 if y is even, 0x03 if y is odd
        let prefix = if y[31] % 2 == 0 { 0x02 } else { 0x03 };

        let mut compressed = vec![prefix];
        compressed.extend_from_slice(x);
        compressed
    } else if key_bytes.len() == 33 && (key_bytes[0] == 0x02 || key_bytes[0] == 0x03) {
        // Already compressed format
        key_bytes
    } else {
        return Err(format!(
            "Invalid public key format. Expected 65 bytes (uncompressed) or 33 bytes (compressed), got {} bytes",
            key_bytes.len()
        ));
    };

    EcdsaPublicKey::read_from_bytes(&compressed_bytes)
        .map_err(|e| format!("Failed to parse public key: {:?}", e))
}

/// Implementation of getting account balances (assets)
async fn get_account_balances_impl(
    client: &mut crate::client::Client,
    account_id_str: &str,
) -> Result<Vec<AccountAsset>, String> {
    tracing::debug!("Getting balances for account: {}", account_id_str);

    let account_id = parse_account_id(account_id_str)?;

    // Sync state before getting balances
    client
        .sync_state()
        .await
        .map_err(|e| format!("Failed to sync state: {}", e))?;

    // Get the account
    let account = client
        .get_account(account_id)
        .await
        .map_err(|e| format!("Failed to get account: {:?}", e))?
        .ok_or_else(|| format!("Account not found: {}", account_id_str))?;

    // Extract assets from account vault
    let assets: Vec<AccountAsset> = account
        .account()
        .vault()
        .assets()
        .map(|asset| {
            if asset.is_fungible() {
                let fungible = asset.unwrap_fungible();
                AccountAsset {
                    faucet_id: fungible.faucet_id().to_bech32(NetworkId::Testnet),
                    amount: fungible.amount(),
                }
            } else {
                let non_fungible = asset.unwrap_non_fungible();
                AccountAsset {
                    faucet_id: non_fungible.faucet_id_prefix().to_string(),
                    amount: 1, // Non-fungible assets have amount 1
                }
            }
        })
        .collect();

    tracing::debug!(
        "Found {} assets for account {}",
        assets.len(),
        account_id_str
    );

    Ok(assets)
}

/// Implementation of minting tokens from a faucet
async fn mint_tokens_impl(
    client: &mut crate::client::Client,
    account_id_str: &str,
    faucet_id_str: &str,
    amount: u64,
) -> Result<String, String> {
    use miden_client::note::NoteType;
    use miden_client::transaction::{PaymentNoteDescription, TransactionRequestBuilder};
    use miden_objects::asset::FungibleAsset;

    tracing::info!(
        "Starting mint_tokens_impl: amount={}, faucet={}, recipient={}",
        amount,
        faucet_id_str,
        account_id_str
    );

    // Parse account IDs
    tracing::debug!("Parsing recipient account ID: {}", account_id_str);
    let account_id = parse_account_id(account_id_str)?;
    tracing::debug!("Parsed recipient account ID: {:?}", account_id);

    tracing::debug!("Parsing faucet account ID: {}", faucet_id_str);
    let faucet_id = parse_account_id(faucet_id_str)?;
    tracing::debug!("Parsed faucet account ID: {:?}", faucet_id);

    // Sync state before minting (syncs recipient account)
    tracing::debug!("Syncing client state...");
    client.sync_state().await.map_err(|e| {
        tracing::error!("Failed to sync state: {}", e);
        format!("Failed to sync state: {}", e)
    })?;
    tracing::debug!("State sync completed successfully");

    // Import the faucet account from chain into client store
    // This is necessary because the faucet is not owned by the client
    tracing::debug!("Importing faucet account from chain: {:?}", faucet_id);
    client.import_account_by_id(faucet_id).await.map_err(|e| {
        let err_msg = format!("Failed to import faucet account: {:?}", e);
        tracing::error!("{}", err_msg);
        err_msg
    })?;
    tracing::debug!("Faucet account imported successfully");

    // Now get the faucet account from the client store
    tracing::debug!("Querying imported faucet account: {:?}", faucet_id);
    let faucet_account = client
        .get_account(faucet_id)
        .await
        .map_err(|e| {
            let err_msg = format!("Failed to query faucet account: {:?}", e);
            tracing::error!("{}", err_msg);
            err_msg
        })?
        .ok_or_else(|| {
            let err_msg = format!(
                "Faucet account not found after import: {}. Verify the faucet account ID is correct.",
                faucet_id_str
            );
            tracing::error!("{}", err_msg);
            err_msg
        })?;
    tracing::debug!("Faucet account retrieved successfully");

    // Create the fungible asset to mint
    tracing::debug!(
        "Creating fungible asset: faucet={:?}, amount={}",
        faucet_id,
        amount
    );
    let asset = FungibleAsset::new(faucet_id, amount).map_err(|e| {
        let err_msg = format!("Failed to create asset: {:?}", e);
        tracing::error!("{}", err_msg);
        err_msg
    })?;
    tracing::debug!("Fungible asset created: {:?}", asset);

    // Create a payment note from the faucet to the account (mimics minting)
    tracing::debug!(
        "Creating payment note: from faucet {:?} to account {:?}",
        faucet_id,
        account_id
    );
    let payment = PaymentNoteDescription::new(vec![asset.into()], faucet_id, account_id);
    tracing::debug!("Payment note created");

    // Build the transaction request to create the note
    tracing::debug!("Building mint transaction request...");
    let tx_request = TransactionRequestBuilder::new()
        .build_pay_to_id(payment, NoteType::Public, client.rng())
        .map_err(|e| {
            let err_msg = format!("Failed to build mint transaction: {:?}", e);
            tracing::error!("{}", err_msg);
            err_msg
        })?;
    tracing::debug!("Transaction request built successfully");

    // Submit the mint transaction to the network
    // The faucet account should now be available in the client store
    tracing::info!(
        "Submitting mint transaction from faucet account: {:?}",
        faucet_id
    );
    let tx_id = client
        .submit_new_transaction(faucet_id, tx_request)
        .await
        .map_err(|e| {
            let err_msg = format!("Failed to submit mint transaction: {:?}", e);
            tracing::error!("{}", err_msg);
            err_msg
        })?;

    tracing::info!("Tokens minted successfully. Transaction ID: {}", tx_id);

    Ok(tx_id.to_string())
}
