import type { Multisig, SyncResult } from "@openzeppelin/miden-multisig-client";

export async function resilientSyncAll(multisig: Multisig, maxRetries = 3, delayMs = 1000): Promise<SyncResult> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await multisig.syncAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("nonce is too low") && attempt < maxRetries) {
        console.warn(`[resilientSyncAll] Nonce too low, retrying (${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error("[resilientSyncAll] Exhausted retries");
}
