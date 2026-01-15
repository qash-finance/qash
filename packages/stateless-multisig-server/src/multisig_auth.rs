//! Custom TransactionAuthenticator for multisig transactions with externally collected signatures.

use std::collections::BTreeMap;

use miden_client::auth::{SigningInputs, TransactionAuthenticator};
use miden_client::AuthenticationError;
use miden_objects::account::auth::{PublicKeyCommitment, Signature};
use miden_objects::crypto::dsa::ecdsa_k256_keccak::Signature as EcdsaSignature;

/// A custom authenticator that stores pre-collected ECDSA K256 Keccak signatures
/// for multisig transactions.
///
/// This authenticator is used when signatures have been collected externally
/// (e.g., from Para wallet) and need to be provided during transaction execution.
pub struct MultisigAuthenticator {
    /// Map of public key commitments to their corresponding signatures
    signatures: BTreeMap<PublicKeyCommitment, EcdsaSignature>,
}

impl MultisigAuthenticator {
    /// Creates a new empty MultisigAuthenticator
    pub fn new() -> Self {
        Self {
            signatures: BTreeMap::new(),
        }
    }

    /// Adds a signature for a given public key commitment
    pub fn add_signature(&mut self, pub_key_commitment: PublicKeyCommitment, signature: EcdsaSignature) {
        self.signatures.insert(pub_key_commitment, signature);
    }

    /// Creates a MultisigAuthenticator from a list of public key commitments and signatures
    pub fn from_signatures(
        signatures: impl IntoIterator<Item = (PublicKeyCommitment, EcdsaSignature)>,
    ) -> Self {
        Self {
            signatures: signatures.into_iter().collect(),
        }
    }
}

impl TransactionAuthenticator for MultisigAuthenticator {
    async fn get_signature(
        &self,
        pub_key: PublicKeyCommitment,
        _signing_inputs: &SigningInputs,
    ) -> Result<Signature, AuthenticationError> {
        // Look up the pre-collected signature for this public key
        let ecdsa_sig = self
            .signatures
            .get(&pub_key)
            .ok_or(AuthenticationError::UnknownPublicKey(pub_key))?;

        // Wrap the ECDSA signature in the Signature enum
        Ok(Signature::EcdsaK256Keccak(ecdsa_sig.clone()))
    }
}
