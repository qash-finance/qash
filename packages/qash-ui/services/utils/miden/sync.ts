import type { Multisig, SyncResult } from "@openzeppelin/miden-multisig-client";
import { AccountInspector } from "@openzeppelin/miden-multisig-client";
import type { WebClient } from "@miden-sdk/miden-sdk";
import { AccountId } from "@miden-sdk/miden-sdk";

/**
 * Wrapper around multisig.syncAll() that falls back to local state when
 * PSM's stored account state is behind the Miden node ("nonce too low").
 */
export async function resilientSyncAll(multisig: Multisig, webClient: WebClient): Promise<SyncResult> {
  try {
    return await multisig.syncAll();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("nonce is too low")) throw err;

    console.warn("[resilientSyncAll] PSM state behind on-chain, using local state");

    const proposals = await multisig.syncTransactionProposals();
    const notes = await multisig.getConsumableNotes();

    const accountId = AccountId.fromHex(multisig.accountId);
    const localAccount = await webClient.getAccount(accountId);
    if (!localAccount) {
      throw new Error(`[resilientSyncAll] No local account for ${multisig.accountId}`);
    }

    const localBytes = localAccount.serialize();
    const stateDataBase64 = btoa(String.fromCharCode(...localBytes));
    const config = AccountInspector.fromBase64(stateDataBase64, multisig.signatureScheme);

    const state = {
      accountId: multisig.accountId,
      commitment: localAccount.commitment().toHex(),
      stateDataBase64,
      createdAt: "",
      updatedAt: new Date().toISOString(),
    };

    return { proposals, state, notes, config };
  }
}
