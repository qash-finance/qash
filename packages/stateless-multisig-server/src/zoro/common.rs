use anyhow::Result;
use miden_client::note::NoteScript;
use miden_client::{
    ClientError, Felt, ScriptBuilder, Word,
    account::AccountId,
    note::{
        Note, NoteAssets, NoteError, NoteExecutionHint, NoteMetadata, NoteRecipient, NoteTag,
        NoteType,
    },
};
use miden_client::{
    DebugMode, builder::ClientBuilder, keystore::FilesystemKeyStore, rpc::GrpcClient,
};
use miden_client_sqlite_store::ClientBuilderSqliteExt;
use miden_lib::{note::utils::build_p2id_recipient, transaction::TransactionKernel};
use std::sync::Arc;
use std::{fs, path::PathBuf};
use tracing::{debug, info, warn};

/// Creates a ZOROSWAP note using the ZOROSWAP.masm script.
///
/// This is specific to the Zoro AMM protocol.
pub fn create_zoroswap_note(
    inputs: Vec<Felt>,
    assets: Vec<miden_client::asset::Asset>,
    creator: AccountId,
    swap_serial_num: Word,
    note_tag: NoteTag,
    note_type: NoteType,
) -> Result<Note, NoteError> {
    use miden_client::note::NoteInputs;

    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let path: PathBuf = [manifest_dir, "src", "zoro", "ZOROSWAP.masm"]
        .iter()
        .collect();
    let note_code = fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("Error reading {}: {}", path.display(), err));
    let assembler = TransactionKernel::assembler()
        .with_debug_mode(true)
        .with_warnings_as_errors(true);
    let program = assembler
        .assemble_program(note_code)
        .unwrap_or_else(|err| panic!("Failed to assemble program: {err:?}"));
    let note_script = NoteScript::new(program);
    let aux = Felt::new(0);

    let inputs = NoteInputs::new(inputs)?;
    // build the outgoing note
    let metadata = NoteMetadata::new(
        creator,
        note_type,
        note_tag,
        NoteExecutionHint::always(),
        aux,
    )?;

    let assets = NoteAssets::new(assets)?;
    let recipient = NoteRecipient::new(swap_serial_num, note_script.clone(), inputs.clone());
    let note = Note::new(assets.clone(), metadata, recipient.clone());

    Ok(note)
}
