import { NODE_ENDPOINT } from "./constant";

/**
 * Convert a hex string to Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Mint tokens from a faucet via a standalone WebClient.
 *
 * Uses importAccountById (for latest on-chain state) + addAccountSecretKeyToWebStore
 * (for the faucet's signing key) so any user can mint, not just the faucet deployer.
 *
 * The faucet secret key hex is read from NEXT_PUBLIC_FAUCET_SECRET_KEY env var.
 * This is exported from the deploy-faucet dev page after deployment.
 *
 * @param _client - unused (kept for API compatibility)
 * @param targetAddress - hex (0x...) or bech32 account ID of the recipient
 * @param faucetAddress - bech32 Address of the faucet (with underscore)
 * @param amount - raw amount (e.g. BigInt(100 * 1e8) for 100 tokens with 8 decimals)
 * @returns transaction hash as hex string
 */
export async function mintTokensViaClient(
  _client: any,
  targetAddress: string,
  faucetAddress: string,
  amount: bigint,
): Promise<string> {
  const { NoteType, Address, AccountId, AuthSecretKey, WebClient } = await import("@miden-sdk/miden-sdk");

  console.log("[mintTokensViaClient] targetAddress:", targetAddress, "faucetAddress:", faucetAddress);

  // Standalone WebClient
  const client = await WebClient.createClient(NODE_ENDPOINT);
  await client.syncState();

  // Parse faucet address
  const faucetId = Address.fromBech32(faucetAddress);

  // Import faucet account from chain (latest state, no keys)
  const faucetExists = await client.getAccount(faucetId.accountId()).catch(() => null);
  if (!faucetExists) {
    try {
      console.log("[mint] Importing faucet account from chain...");
      await client.importAccountById(faucetId.accountId());
      console.log("[mint] Faucet account imported from chain");
    } catch (importErr) {
      console.warn("[mint] Could not import faucet account:", importErr);
    }
  }

  // Inject the faucet's auth secret key so we can sign mint transactions
  const faucetSecretKeyHex = process.env.NEXT_PUBLIC_FAUCET_SECRET_KEY;
  if (faucetSecretKeyHex) {
    try {
      console.log("[mint] Injecting faucet secret key...");
      const keyBytes = hexToBytes(faucetSecretKeyHex);
      const secretKey = AuthSecretKey.deserialize(keyBytes);
      await client.addAccountSecretKeyToWebStore(faucetId.accountId(), secretKey);
      console.log("[mint] Faucet secret key injected successfully");
    } catch (keyErr) {
      console.warn("[mint] Could not inject faucet secret key:", keyErr);
    }
  } else {
    console.warn("[mint] NEXT_PUBLIC_FAUCET_SECRET_KEY not set — mint will only work for the faucet deployer");
  }

  await client.syncState();

  // Parse target account ID
  let targetAccountId: any;
  if (targetAddress.startsWith("0x")) {
    targetAccountId = AccountId.fromHex(targetAddress);
  } else if (targetAddress.includes("_")) {
    targetAccountId = Address.fromBech32(targetAddress).accountId();
  } else {
    targetAccountId = AccountId.fromBech32(targetAddress);
  }

  // Import target account so the client knows about it
  try {
    const account = await client.getAccount(targetAccountId);
    if (!account) {
      await client.importAccountById(targetAccountId);
    }
  } catch {
    try {
      await client.importAccountById(targetAccountId);
    } catch (importErr) {
      console.warn("[mint] Could not import target account:", importErr);
    }
  }

  await client.syncState();

  // Mint: faucet creates a public note addressed to the target
  const mintTxRequest = client.newMintTransactionRequest(
    targetAccountId,
    faucetId.accountId(),
    NoteType.Public,
    amount,
  );

  const txHash = await client.submitNewTransaction(faucetId.accountId(), mintTxRequest);
  console.log("[mintTokensViaClient] Mint tx submitted:", txHash.toHex());

  return txHash.toHex();
}
