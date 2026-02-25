"use client";

export interface BatchRecipient {
  recipientHex: string; // hex account ID
  faucetHex: string; // hex faucet ID
  amount: bigint; // raw amount (already scaled by decimals)
}

/** Serializable batch recipient (amounts as strings for JSON storage in PSM metadata) */
export interface BatchRecipientSerialized {
  recipientHex: string;
  faucetHex: string;
  amount: string;
}

/**
 * Convert a Miden address to hex account ID.
 * Accepts bech32 (mtst1…), hex (0x…), or raw hex formats.
 * Strips the routing-parameter suffix (everything after '_') if present.
 */
export async function bech32ToHex(address: string): Promise<string> {
  // Already hex-prefixed — return as-is
  if (address.startsWith("0x") || address.startsWith("0X")) {
    return address;
  }

  // If the address looks like raw hex (only hex chars, no bech32 prefix), prefix it
  if (/^[0-9a-fA-F]+$/.test(address)) {
    return `0x${address}`;
  }

  const { AccountId } = await import("@miden-sdk/miden-sdk");
  const base = address.split("_")[0];
  return AccountId.fromBech32(base).toString();
}

/**
 * Encode a Uint8Array to base64 string.
 * Needed because @openzeppelin/miden-multisig-client does not export this utility.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---- Internal helpers ----

function normalizeHexWord(hex: string): string {
  const prefixed = hex.startsWith("0x") || hex.startsWith("0X") ? hex : `0x${hex}`;
  let clean = prefixed.slice(2).toLowerCase();
  clean = clean.padStart(64, "0");
  return `0x${clean}`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

function signatureHexToBytes(hex: string, scheme: string = "falcon"): Uint8Array {
  const sigBytes = hexToBytes(hex);
  const withPrefix = new Uint8Array(sigBytes.length + 1);
  withPrefix[0] = scheme === "ecdsa" ? 1 : 0;
  withPrefix.set(sigBytes, 1);
  return withPrefix;
}

/**
 * Build a batch P2ID TransactionRequest containing one output note per recipient.
 * Replicates the pattern from the PSM SDK's p2id.ts but supports multiple recipients.
 *
 * Note salts are derived deterministically from the auth salt + note index,
 * so the exact same transaction can be rebuilt during execution.
 *
 * All IDs must be in hex format (use bech32ToHex to convert first).
 */
export async function buildBatchP2idTransactionRequest(
  senderHex: string,
  recipients: BatchRecipient[],
  options?: {
    /** Pre-existing auth salt hex (for reconstruction during execution). Random if omitted. */
    authSaltHex?: string;
    /** Signature advice map to include in the request (used during execution). */
    adviceMap?: any;
  },
): Promise<{ request: import("@miden-sdk/miden-sdk").TransactionRequest; saltHex: string }> {
  const {
    AccountId,
    Felt,
    FeltArray,
    FungibleAsset,
    MidenArrays,
    Note,
    NoteAssets,
    NoteInputs,
    NoteMetadata,
    NoteRecipient,
    NoteScript,
    NoteTag,
    NoteType,
    OutputNote,
    Rpo256,
    TransactionRequestBuilder,
    Word: WordType,
  } = await import("@miden-sdk/miden-sdk");

  const sender = AccountId.fromHex(senderHex);

  let authSaltWord: InstanceType<typeof WordType>;
  let authSaltHex: string;

  if (options?.authSaltHex) {
    authSaltWord = WordType.fromHex(normalizeHexWord(options.authSaltHex));
    authSaltHex = options.authSaltHex;
  } else {
    const authSaltBytes = new Uint8Array(32);
    crypto.getRandomValues(authSaltBytes);
    const view = new DataView(authSaltBytes.buffer);
    const u64s = new BigUint64Array([
      view.getBigUint64(0, true),
      view.getBigUint64(8, true),
      view.getBigUint64(16, true),
      view.getBigUint64(24, true),
    ]);
    authSaltWord = new WordType(u64s);
    authSaltHex = authSaltWord.toHex();
  }

  // Build one P2ID output note per recipient
  const outputNotes: any[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const recipient = AccountId.fromHex(r.recipientHex);
    const faucet = AccountId.fromHex(r.faucetHex);

    // Create fungible asset
    const asset = new FungibleAsset(faucet, r.amount);
    const noteAssets = new NoteAssets([asset]);

    // Derive note salt DETERMINISTICALLY from auth salt + note index.
    // This ensures the exact same transaction can be reproduced during execution
    // given only the auth salt (stored in txSummary) and the recipients list.
    const noteSaltWord = Rpo256.hashElements(new FeltArray([...authSaltWord.toFelts(), new Felt(BigInt(i + 1))]));

    // Build the P2ID note (same logic as PSM SDK's buildP2idNote)
    const serialNum = Rpo256.hashElements(new FeltArray([...noteSaltWord.toFelts(), new Felt(BigInt(0))]));

    const noteScript = NoteScript.p2id();
    const noteInputs = new NoteInputs(new FeltArray([recipient.suffix(), recipient.prefix()]));

    const noteRecipient = new NoteRecipient(serialNum, noteScript, noteInputs);
    const noteTag = NoteTag.withAccountTarget(recipient);
    const noteMetadata = new NoteMetadata(sender, NoteType.Public, noteTag);

    const note = new Note(noteAssets, noteMetadata, noteRecipient);
    outputNotes.push(OutputNote.full(note));
  }

  // Build the TransactionRequest with all output notes and the auth salt
  const authSaltForBuilder = WordType.fromHex(normalizeHexWord(authSaltHex));
  let txBuilder = new TransactionRequestBuilder();
  txBuilder = txBuilder.withOwnOutputNotes(new MidenArrays.OutputNoteArray(outputNotes));
  txBuilder = txBuilder.withAuthArg(authSaltForBuilder);

  if (options?.adviceMap) {
    txBuilder = txBuilder.extendAdviceMap(options.adviceMap);
  }

  return {
    request: txBuilder.build(),
    saltHex: authSaltHex,
  };
}

/**
 * Execute a batch P2ID proposal with custom transaction rebuilding.
 *
 * The OZ library's `executeTransactionProposal` only supports single-recipient P2ID.
 * For batch sends (multiple recipients), we replicate the execution workflow but rebuild
 * the correct multi-recipient transaction instead of a single-recipient one.
 *
 * This replicates the logic from:
 *   @openzeppelin/miden-multisig-client/dist/multisig/proposal/execution.js
 */
export async function executeBatchProposal(params: {
  webClient: any;
  psmClient: any;
  multisig: any;
  accountId: string;
  commitment: string;
  psmCommitment: string;
  psmPublicKey?: string;
  /** Batch recipients from backend metadata (hex-converted addresses + amount as string) */
  batchRecipients: BatchRecipientSerialized[];
}): Promise<void> {
  const { AccountId, AdviceMap, Felt, FeltArray, Rpo256, Signature, TransactionSummary, Word } =
    await import("@miden-sdk/miden-sdk");
  const { tryComputeEcdsaCommitmentHex } = await import("@openzeppelin/miden-multisig-client");

  const { webClient, psmClient, multisig, accountId, commitment, psmCommitment, psmPublicKey, batchRecipients } = params;
  const signatureScheme: string = multisig.signatureScheme;

  if (!batchRecipients || batchRecipients.length === 0) {
    throw new Error("Batch recipients are required for batch execution");
  }

  // 1. Get proposal from synced Multisig (must call syncAll() before this)
  const proposals = multisig.listTransactionProposals();
  const proposal = proposals.find((p: any) => p.commitment === commitment);
  if (!proposal) throw new Error(`Batch proposal not found in PSM: ${commitment}`);

  // 2. Check threshold
  const effectiveThreshold = multisig.getEffectiveThreshold(proposal.metadata.proposalType);
  if (proposal.signatures.length < effectiveThreshold) {
    throw new Error("Proposal is not ready for execution. Still pending signatures.");
  }

  // 3. Get delta from PSM
  const deltas = await psmClient.getDeltaProposals(accountId);
  const delta = deltas.find((d: any) => {
    const bytes = base64ToUint8Array(d.deltaPayload.txSummary.data);
    const summary = TransactionSummary.deserialize(bytes);
    return normalizeHexWord(summary.toCommitment().toHex()) === normalizeHexWord(commitment);
  });
  if (!delta) throw new Error(`Delta not found on PSM for commitment: ${commitment}`);

  // 4. Extract salt and commitment from txSummary
  const txSummaryBytes = base64ToUint8Array(delta.deltaPayload.txSummary.data);
  const txSummary = TransactionSummary.deserialize(txSummaryBytes);
  const saltHex = txSummary.salt().toHex();
  const txCommitmentHex = txSummary.toCommitment().toHex();

  // 5. Build cosigner advice map (replicates buildCosignerAdviceMap from execution.js)
  const adviceMap = new AdviceMap();
  const normalizedSignerCommitments = new Set(
    (multisig.signerCommitments as string[]).map((c: string) => normalizeHexWord(c)),
  );

  for (const cosignerSig of proposal.signatures) {
    let signerCommitmentHex = normalizeHexWord(cosignerSig.signerId);

    // For ECDSA signers, derive the commitment from the public key
    if (cosignerSig.signature.scheme === "ecdsa" && cosignerSig.signature.publicKey) {
      const derived = tryComputeEcdsaCommitmentHex(cosignerSig.signature.publicKey);
      if (derived && derived !== signerCommitmentHex) {
        if (!normalizedSignerCommitments.has(derived)) {
          throw new Error("ECDSA public key commitment mismatch: derived commitment is not in signerCommitments.");
        }
        signerCommitmentHex = derived;
      }
    }

    const signerCommitmentWord = Word.fromHex(signerCommitmentHex);
    const sigBytes = signatureHexToBytes(cosignerSig.signature.signature, cosignerSig.signature.scheme);
    const signature = Signature.deserialize(sigBytes);
    const txCommitmentWord = Word.fromHex(normalizeHexWord(txCommitmentHex));

    const isEcdsa = cosignerSig.signature.scheme === "ecdsa" && cosignerSig.signature.publicKey;
    const { key, values } = buildAdviceEntry(
      Rpo256,
      Felt,
      FeltArray,
      signerCommitmentWord,
      txCommitmentWord,
      signature,
      isEcdsa ? cosignerSig.signature.publicKey : undefined,
      isEcdsa ? cosignerSig.signature.signature : undefined,
    );
    adviceMap.insert(key, new FeltArray(values));
  }

  // 6. Push delta to PSM for acknowledgment signature
  const executionDelta = {
    ...delta,
    deltaPayload: delta.deltaPayload.txSummary,
  };
  const pushResult = await psmClient.pushDelta(executionDelta);
  const ackSigHex = pushResult.ackSig;
  if (!ackSigHex) throw new Error("PSM did not return acknowledgment signature");

  // Add PSM ACK signature to advice map
  const psmAckScheme = pushResult.ackScheme || signatureScheme;
  const ackPubkey = pushResult.ackPubkey || psmPublicKey;

  const normalizedPsmCommitment = normalizeHexWord(psmCommitment);
  if (psmAckScheme === "ecdsa" && ackPubkey) {
    const derived = tryComputeEcdsaCommitmentHex(ackPubkey);
    if (derived && derived !== normalizedPsmCommitment) {
      throw new Error("PSM public key commitment mismatch");
    }
  }

  const psmCommitmentWord = Word.fromHex(normalizedPsmCommitment);
  const ackSigBytes = signatureHexToBytes(ackSigHex, psmAckScheme);
  const ackSignature = Signature.deserialize(ackSigBytes);
  const txCommitmentWord = Word.fromHex(normalizeHexWord(txCommitmentHex));

  const isAckEcdsa = psmAckScheme === "ecdsa" && ackPubkey;
  const { key: ackKey, values: ackValues } = buildAdviceEntry(
    Rpo256,
    Felt,
    FeltArray,
    psmCommitmentWord,
    txCommitmentWord,
    ackSignature,
    isAckEcdsa ? ackPubkey : undefined,
    isAckEcdsa ? ackSigHex : undefined,
  );
  adviceMap.insert(ackKey, new FeltArray(ackValues));

  // 7. Rebuild the batch TransactionRequest with the original salt and advice map
  const recipients: BatchRecipient[] = batchRecipients.map(r => ({
    recipientHex: r.recipientHex,
    faucetHex: r.faucetHex,
    amount: BigInt(r.amount),
  }));

  const { request } = await buildBatchP2idTransactionRequest(accountId, recipients, {
    authSaltHex: saltHex,
    adviceMap,
  });

  // 8. Execute, prove, submit, and apply
  const accountIdObj = AccountId.fromHex(accountId);
  const result = await webClient.executeTransaction(accountIdObj, request);
  const proven = await webClient.proveTransaction(result, null);
  const submissionHeight = await webClient.submitProvenTransaction(proven, result);
  await webClient.applyTransaction(result, submissionHeight);
}

/**
 * Build a signature advice map entry.
 * Replicates buildSignatureAdviceEntry from the OZ library's signature.js
 */
function buildAdviceEntry(
  Rpo256: any,
  Felt: any,
  FeltArray: any,
  pubkeyCommitment: any,
  message: any,
  signature: any,
  ecdsaPubkeyHex?: string,
  ecdsaSigHex?: string,
): { key: any; values: any[] } {
  const elements = new FeltArray([...pubkeyCommitment.toFelts(), ...message.toFelts()]);
  const key = Rpo256.hashElements(elements);

  let values: any[];
  if (ecdsaPubkeyHex && ecdsaSigHex) {
    const pkBytes = hexToBytes(ecdsaPubkeyHex);
    const sigBytes = hexToBytes(ecdsaSigHex);
    values = encodeEcdsaSignatureFelts(Felt, pkBytes, sigBytes);
  } else {
    values = signature.toPreparedSignature(message);
  }
  return { key, values };
}

/**
 * Encode ECDSA public key + signature as packed U32 Felt array (reversed).
 * Replicates encodeEcdsaSignatureFelts from the OZ library's signature.js
 */
function encodeEcdsaSignatureFelts(Felt: any, pubkeyBytes: Uint8Array, sigBytes: Uint8Array): any[] {
  const pkFelts = bytesToPackedU32Felts(Felt, pubkeyBytes);
  const sigFelts = bytesToPackedU32Felts(Felt, sigBytes);
  const encoded = [...pkFelts, ...sigFelts];
  encoded.reverse();
  return encoded;
}

/**
 * Pack bytes into U32 Felt array (little-endian, 4 bytes per felt).
 * Replicates bytesToPackedU32Felts from the OZ library's signature.js
 */
function bytesToPackedU32Felts(Felt: any, bytes: Uint8Array): any[] {
  const felts = [];
  for (let i = 0; i < bytes.length; i += 4) {
    let packed = 0;
    for (let j = 0; j < 4 && i + j < bytes.length; j++) {
      packed |= bytes[i + j] << (j * 8);
    }
    felts.push(new Felt(BigInt(packed >>> 0)));
  }
  return felts;
}
