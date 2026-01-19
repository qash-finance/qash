//! A client for managing ECDSA K256 Keccak multisig transactions.

use alloc::vec::Vec;

extern crate alloc;

use miden_client::{
    Client, ClientError, Felt, Word, ZERO,
    account::{Account, AccountBuilder, AccountId, AccountStorageMode, AccountType},
    auth::{SigningInputs, TransactionAuthenticator},
    transaction::{TransactionExecutorError, TransactionId, TransactionRequest},
};
use miden_crypto::dsa::ecdsa_k256_keccak::PublicKey as EcdsaPublicKey;
use miden_crypto::utils::{Deserializable as CryptoDeserializable, SliceReader};
use miden_lib::account::{
    auth::{AuthEcdsaK256KeccakMultisig, AuthEcdsaK256KeccakMultisigConfig},
    wallets::BasicWallet,
};
use miden_objects::{Hasher, account::auth::PublicKeyCommitment, transaction::TransactionSummary};
use rand::RngCore;
use thiserror::Error;

/// Represents errors that can occur in the multisig client.
#[derive(Debug, Error)]
pub enum MultisigError {
    /// An error occurred while parsing a public key.
    #[error("public key parse error: {0}")]
    PublicKeyParseError(String),

    /// An error occurred while creating the multisig config.
    #[error("multisig config error: {0}")]
    ConfigError(String),

    /// An error occurred while proposing a new transaction.
    #[error("multisig transaction proposal error: {0}")]
    TxProposalError(String),

    /// An error occurred while executing a transaction.
    #[error("multisig transaction execution error: {0}")]
    TxExecutionError(String),

    /// An error occurred with the client.
    #[error("client error: {0}")]
    ClientError(String),
}

impl From<ClientError> for MultisigError {
    fn from(e: ClientError) -> Self {
        MultisigError::ClientError(e.to_string())
    }
}

/// Converts an uncompressed or compressed secp256k1 public key hex string to a PublicKeyCommitment.
///
/// Supports:
/// - Uncompressed format: 65 bytes starting with 0x04
/// - Compressed format: 33 bytes starting with 0x02 or 0x03
pub fn public_key_from_hex(hex_str: &str) -> Result<PublicKeyCommitment, MultisigError> {
    // Remove "0x" prefix if present
    let hex_str = hex_str.strip_prefix("0x").unwrap_or(hex_str);

    // Decode hex to bytes
    let key_bytes = hex::decode(hex_str)
        .map_err(|e| MultisigError::PublicKeyParseError(format!("Invalid hex: {}", e)))?;

    // Convert to compressed format if uncompressed
    let compressed_bytes = if key_bytes.len() == 65 && key_bytes[0] == 0x04 {
        // Uncompressed format: 04 || x (32 bytes) || y (32 bytes)
        // Compressed format: (02 if y is even, 03 if y is odd) || x (32 bytes)
        let x = &key_bytes[1..33];
        let y = &key_bytes[33..65];

        // Check if y is even or odd (last byte determines parity)
        let prefix = if y[31] % 2 == 0 { 0x02 } else { 0x03 };

        let mut compressed = Vec::with_capacity(33);
        compressed.push(prefix);
        compressed.extend_from_slice(x);
        compressed
    } else if key_bytes.len() == 33 && (key_bytes[0] == 0x02 || key_bytes[0] == 0x03) {
        // Already compressed
        key_bytes
    } else {
        return Err(MultisigError::PublicKeyParseError(format!(
            "Invalid public key format: expected 65 bytes (uncompressed) or 33 bytes (compressed), got {} bytes",
            key_bytes.len()
        )));
    };

    let mut reader = SliceReader::new(&compressed_bytes);
    let public_key = EcdsaPublicKey::read_from(&mut reader).map_err(|e| {
        MultisigError::PublicKeyParseError(format!("Failed to parse public key: {:?}", e))
    })?;

    let crypto_word = public_key.to_commitment();
    let word = Word::new([
        Felt::new(crypto_word[0].as_int()),
        Felt::new(crypto_word[1].as_int()),
        Felt::new(crypto_word[2].as_int()),
        Felt::new(crypto_word[3].as_int()),
    ]);

    Ok(PublicKeyCommitment::from(word))
}

/// Converts a list of hex-encoded public keys to PublicKeyCommitments.
pub fn public_keys_from_hex(
    hex_keys: &[String],
) -> Result<Vec<PublicKeyCommitment>, MultisigError> {
    hex_keys
        .iter()
        .map(|pk_hex| public_key_from_hex(pk_hex))
        .collect()
}

/// Multisig operations that can be performed on a Miden client.
pub struct MultisigOps;

impl MultisigOps {
    /// Sets up a new ECDSA K256 Keccak multisig account with the specified approvers and threshold.
    ///
    /// # Arguments
    /// * `client` - The Miden client to use
    /// * `approvers` - List of public key commitments for the approvers
    /// * `threshold` - Number of signatures required to execute a transaction
    ///
    /// # Returns
    /// The created multisig account
    pub async fn setup_account<AUTH>(
        client: &mut Client<AUTH>,
        approvers: Vec<PublicKeyCommitment>,
        threshold: u32,
    ) -> Result<Account, MultisigError>
    where
        AUTH: TransactionAuthenticator + Sync + 'static,
    {
        let mut init_seed = [0u8; 32];
        client.rng().fill_bytes(&mut init_seed);

        let config = AuthEcdsaK256KeccakMultisigConfig::new(approvers, threshold)
            .map_err(|e| MultisigError::ConfigError(e.to_string()))?;

        let multisig_auth_component = AuthEcdsaK256KeccakMultisig::new(config)
            .map_err(|e| MultisigError::ConfigError(e.to_string()))?;

        let multisig_account = AccountBuilder::new(init_seed)
            .with_auth_component(multisig_auth_component)
            .account_type(AccountType::RegularAccountImmutableCode)
            .storage_mode(AccountStorageMode::Public)
            .with_component(BasicWallet)
            .build()
            .map_err(|e| MultisigError::ConfigError(e.to_string()))?;

        client.add_account(&multisig_account, false).await?;

        Ok(multisig_account)
    }

    /// Propose a multisig transaction. This "dry-runs" the transaction and returns
    /// the `TransactionSummary` without executing it.
    ///
    /// This is used to get the transaction details that need to be signed by the approvers.
    pub async fn propose_transaction<AUTH>(
        client: &mut Client<AUTH>,
        account_id: AccountId,
        transaction_request: TransactionRequest,
    ) -> Result<TransactionSummary, MultisigError>
    where
        AUTH: TransactionAuthenticator + Sync + 'static,
    {
        let tx_result = client
            .submit_new_transaction(account_id, transaction_request)
            .await;

        match tx_result {
            Ok(_) => Err(MultisigError::TxProposalError(
                "expecting a dry run, but tx was executed".to_string(),
            )),
            // Match on Unauthorized - this is expected for multisig proposals
            Err(ClientError::TransactionExecutorError(TransactionExecutorError::Unauthorized(
                summary,
            ))) => Ok(*summary),
            Err(e) => Err(MultisigError::TxProposalError(e.to_string())),
        }
    }

    /// Creates and executes a transaction with the provided signatures.
    ///
    /// # Arguments
    /// * `client` - The Miden client to use
    /// * `account` - The multisig account
    /// * `transaction_request` - The transaction to execute
    /// * `transaction_summary` - The summary from the proposal step
    /// * `signatures` - List of signatures from approvers (None for approvers who didn't sign)
    ///
    /// # Returns
    /// The transaction result
    pub async fn execute_transaction<AUTH>(
        client: &mut Client<AUTH>,
        account: Account,
        mut transaction_request: TransactionRequest,
        transaction_summary: TransactionSummary,
        signatures: Vec<Option<Vec<Felt>>>,
    ) -> Result<TransactionId, MultisigError>
    where
        AUTH: TransactionAuthenticator + Sync + 'static,
    {
        // Add signatures to the advice provider
        let advice_inputs = transaction_request.advice_map_mut();
        let msg = transaction_summary.to_commitment();

        // Get number of approvers from storage slot 0
        let num_approvers: u32 = account
            .storage()
            .get_item(0)
            .map_err(|e| MultisigError::TxExecutionError(e.to_string()))?
            .as_elements()[1]
            .try_into()
            .map_err(|_| MultisigError::TxExecutionError("Invalid num_approvers".to_string()))?;

        for i in 0..num_approvers as usize {
            let pub_key_index_word = Word::from([Felt::from(i as u32), ZERO, ZERO, ZERO]);
            let pub_key = account
                .storage()
                .get_map_item(1, pub_key_index_word)
                .map_err(|e| MultisigError::TxExecutionError(e.to_string()))?;
            let sig_key = Hasher::merge(&[pub_key, msg]);

            if let Some(signature) = signatures.get(i).and_then(|s| s.as_ref()) {
                advice_inputs.extend(vec![(sig_key, signature.clone())]);
            }
        }

        client
            .submit_new_transaction(account.id(), transaction_request)
            .await
            .map_err(|e| MultisigError::TxExecutionError(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_public_key_from_hex_uncompressed() {
        // Example uncompressed public key (65 bytes)
        let uncompressed = "0x043c3fe6c2aba8d9c0a44086546906a4a25661b0624d3aa5797f756dc1da3cc5faaf5e050efe1ea993e4adef6ee4fbb00c926782b31e68390142b6efc9c15ecc7d";
        let result = public_key_from_hex(uncompressed);
        assert!(result.is_ok());
    }

    #[test]
    fn test_public_key_from_hex_invalid() {
        // Invalid length
        let invalid = "0x1234";
        let result = public_key_from_hex(invalid);
        assert!(result.is_err());
    }
}
