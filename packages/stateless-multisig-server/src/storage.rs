//! In-memory storage for multisig data.
//!
//! This module provides storage for:
//! - Multisig account metadata
//! - Transaction proposals
//! - Collected signatures

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use serde::{Deserialize, Serialize};

/// Unique identifier for a transaction proposal
pub type ProposalId = String;

/// Unique identifier for an account
pub type AccountIdStr = String;

/// Stored multisig account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultisigAccountInfo {
    /// The account ID as a string
    pub account_id: String,
    /// List of approver commitments (hex-encoded commitment hashes)
    pub approvers: Vec<String>,
    /// List of original approver public keys (hex-encoded, uncompressed format)
    /// These are needed for VM execution - the VM needs the full public key to verify signatures
    pub original_public_keys: Vec<String>,
    /// Number of signatures required
    pub threshold: u32,
    /// Timestamp when the account was created
    pub created_at: u64,
}

/// A transaction proposal waiting for signatures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionProposal {
    /// Unique proposal ID
    pub proposal_id: String,
    /// The account ID this proposal is for
    pub account_id: String,
    /// Description of the transaction
    pub description: String,
    /// The transaction summary commitment (serialized as hex)
    pub summary_commitment: String,
    /// The full transaction summary (serialized)
    pub summary_bytes: Vec<u8>,
    /// Transaction request bytes (serialized)
    pub request_bytes: Vec<u8>,
    /// Collected signatures indexed by approver index (hex-encoded serialized signatures)
    pub signatures: HashMap<usize, String>,
    /// Status of the proposal
    pub status: ProposalStatus,
    /// Timestamp when the proposal was created
    pub created_at: u64,
    /// Note IDs involved in this transaction
    pub note_ids: Vec<String>,
}

/// Status of a transaction proposal
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProposalStatus {
    /// Waiting for signatures
    Pending,
    /// Has enough signatures, ready to execute
    Ready,
    /// Transaction has been executed
    Executed,
    /// Transaction failed or was cancelled
    Failed,
}

/// Information about a consumable note
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsumableNoteInfo {
    /// The note ID
    pub note_id: String,
    /// The asset amounts in the note
    pub assets: Vec<AssetInfo>,
    /// The sender account ID (if known)
    pub sender: Option<String>,
    /// Note type/tag
    pub note_type: String,
}

/// Asset information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInfo {
    /// Faucet ID
    pub faucet_id: String,
    /// Amount
    pub amount: u64,
}

/// In-memory storage for all multisig-related data
#[derive(Debug, Clone)]
pub struct MultisigStorage {
    /// Stored multisig accounts
    accounts: Arc<RwLock<HashMap<AccountIdStr, MultisigAccountInfo>>>,
    /// Transaction proposals
    proposals: Arc<RwLock<HashMap<ProposalId, TransactionProposal>>>,
    /// Mapping from account ID to list of proposal IDs
    account_proposals: Arc<RwLock<HashMap<AccountIdStr, Vec<ProposalId>>>>,
}

impl MultisigStorage {
    /// Creates a new empty storage
    pub fn new() -> Self {
        Self {
            accounts: Arc::new(RwLock::new(HashMap::new())),
            proposals: Arc::new(RwLock::new(HashMap::new())),
            account_proposals: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // === Account Methods ===

    /// Stores a new multisig account
    pub async fn add_account(&self, info: MultisigAccountInfo) {
        let account_id = info.account_id.clone();
        self.accounts.write().await.insert(account_id, info);
    }

    /// Gets a multisig account by ID
    pub async fn get_account(&self, account_id: &str) -> Option<MultisigAccountInfo> {
        self.accounts.read().await.get(account_id).cloned()
    }

    /// Lists all multisig accounts
    pub async fn list_accounts(&self) -> Vec<MultisigAccountInfo> {
        self.accounts.read().await.values().cloned().collect()
    }

    // === Proposal Methods ===

    /// Creates a new transaction proposal
    pub async fn create_proposal(&self, proposal: TransactionProposal) -> String {
        let proposal_id = proposal.proposal_id.clone();
        let account_id = proposal.account_id.clone();

        self.proposals
            .write()
            .await
            .insert(proposal_id.clone(), proposal);

        self.account_proposals
            .write()
            .await
            .entry(account_id)
            .or_default()
            .push(proposal_id.clone());

        proposal_id
    }

    /// Gets a proposal by ID
    pub async fn get_proposal(&self, proposal_id: &str) -> Option<TransactionProposal> {
        self.proposals.read().await.get(proposal_id).cloned()
    }

    /// Gets all proposals for an account
    pub async fn get_account_proposals(&self, account_id: &str) -> Vec<TransactionProposal> {
        let proposal_ids = self
            .account_proposals
            .read()
            .await
            .get(account_id)
            .cloned()
            .unwrap_or_default();

        let proposals = self.proposals.read().await;
        proposal_ids
            .iter()
            .filter_map(|id| proposals.get(id).cloned())
            .collect()
    }

    /// Adds a signature to a proposal (hex-encoded serialized signature)
    pub async fn add_signature(
        &self,
        proposal_id: &str,
        approver_index: usize,
        signature_hex: String,
    ) -> Result<(), String> {
        let mut proposals = self.proposals.write().await;
        let proposal = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| format!("Proposal {} not found", proposal_id))?;

        if proposal.status != ProposalStatus::Pending {
            return Err(format!("Proposal {} is not pending", proposal_id));
        }

        proposal.signatures.insert(approver_index, signature_hex);

        Ok(())
    }

    /// Updates proposal status
    pub async fn update_proposal_status(
        &self,
        proposal_id: &str,
        status: ProposalStatus,
    ) -> Result<(), String> {
        let mut proposals = self.proposals.write().await;
        let proposal = proposals
            .get_mut(proposal_id)
            .ok_or_else(|| format!("Proposal {} not found", proposal_id))?;

        proposal.status = status;
        Ok(())
    }

    /// Checks if a proposal has enough signatures
    pub async fn check_threshold(&self, proposal_id: &str) -> Result<bool, String> {
        let proposals = self.proposals.read().await;
        let proposal = proposals
            .get(proposal_id)
            .ok_or_else(|| format!("Proposal {} not found", proposal_id))?;

        let account = self
            .get_account(&proposal.account_id)
            .await
            .ok_or_else(|| format!("Account {} not found", proposal.account_id))?;

        Ok(proposal.signatures.len() >= account.threshold as usize)
    }

    /// Gets signatures for a proposal as hex strings
    pub async fn get_signatures_hex(&self, proposal_id: &str) -> Result<Vec<Option<String>>, String> {
        let proposals = self.proposals.read().await;
        let proposal = proposals
            .get(proposal_id)
            .ok_or_else(|| format!("Proposal {} not found", proposal_id))?;

        let account = self
            .get_account(&proposal.account_id)
            .await
            .ok_or_else(|| format!("Account {} not found", proposal.account_id))?;

        let mut signatures = Vec::with_capacity(account.approvers.len());
        for i in 0..account.approvers.len() {
            signatures.push(proposal.signatures.get(&i).cloned());
        }

        Ok(signatures)
    }
}

impl Default for MultisigStorage {
    fn default() -> Self {
        Self::new()
    }
}
