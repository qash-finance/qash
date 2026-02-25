"use client";
import { importAndGetAccount } from "./account";
import { FaucetMetadata } from "@/types/faucet";
import { NODE_ENDPOINT } from "../constant";

/// @param symbol can't exceed 6 characters
/// @param decimals can't exceed 12
export async function deployFaucet(
  symbol: string,
  decimals: number,
  maxSupply: number,
  existingClient?: import("@miden-sdk/miden-sdk").WebClient,
): Promise<any> {
  try {
    const { AccountStorageMode, WebClient } = await import("@miden-sdk/miden-sdk");
    const client = existingClient ?? (await WebClient.createClient(NODE_ENDPOINT));
    const faucet = await client.newFaucet(AccountStorageMode.public(), false, symbol, decimals, BigInt(maxSupply), 1);
    return faucet;
  } catch (err) {
    throw new Error("Failed to deploy faucet");
  }
}

const faucetMetadataCache = new Map<string, Promise<FaucetMetadata>>();

export const getFaucetMetadata = async (
  client: import("@miden-sdk/miden-sdk").WebClient,
  faucetId: string,
): Promise<FaucetMetadata> => {
  const faucetIdStr = faucetId.toString();

  // Check if we already have this metadata cached or being fetched
  if (faucetMetadataCache.has(faucetIdStr)) {
    return faucetMetadataCache.get(faucetIdStr)!;
  }

  // Create a promise for this metadata fetch (evict from cache on failure)
  const metadataPromise = (async () => {
    const { BasicFungibleFaucetComponent } = await import("@miden-sdk/miden-sdk");
    const faucetAccount = await importAndGetAccount(client, faucetId);
    const metadata = await BasicFungibleFaucetComponent.fromAccount(faucetAccount);

    return {
      symbol: metadata.symbol().toString(),
      decimals: metadata.decimals(),
      maxSupply: Number(metadata.maxSupply()),
    };
  })().catch(err => {
    // Evict from cache on failure so retries can succeed
    faucetMetadataCache.delete(faucetIdStr);
    throw err;
  });

  // Cache the promise to prevent duplicate calls
  faucetMetadataCache.set(faucetIdStr, metadataPromise);

  return metadataPromise;
};
