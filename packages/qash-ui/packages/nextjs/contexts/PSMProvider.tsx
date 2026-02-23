"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { useMidenProvider } from "./MidenProvider";
import { PSM_ENDPOINT, PSM_SYNC_INTERVAL } from "@/services/utils/constant";
import { supportedTokens } from "@/services/utils/supportedToken";
import { getFaucetMetadata } from "@/services/utils/miden/faucet";
import { useParaSigner } from "@/hooks/web3/useParaSigner";
import { useGetMyCompany } from "@/services/api/company";
import { useListAccountsByCompany } from "@/services/api/multisig";
import type { MultisigClient, Multisig, SyncResult } from "@openzeppelin/miden-multisig-client";

type PSMStatus = "connecting" | "connected" | "error";

export interface EnrichedBalance {
  faucetId: string;
  faucetBech32: string;
  amount: bigint;
  symbol: string;
  decimals: number;
}

export interface AccountCache {
  syncResult: SyncResult;
  enrichedBalances: EnrichedBalance[];
}

interface PSMContextType {
  multisigClient: MultisigClient | null;
  psmCommitment: string;
  psmPublicKey: string | undefined;
  psmStatus: PSMStatus;
  error: string | null;
  syncWarning: string | null;
  reconnect: () => Promise<void>;
  registerMultisig: (accountId: string, multisig: Multisig, syncResult?: SyncResult) => void;
  getMultisig: (accountId: string) => Multisig | undefined;
  pauseSync: () => void;
  resumeSync: () => void;
  sync: () => Promise<void>;
  accountCacheMap: Map<string, AccountCache>;
}

const PSMContext = createContext<PSMContextType | undefined>(undefined);

export function PSMProvider({ children }: { children: ReactNode }) {
  const { client: webClient } = useMidenProvider();
  const { isReady: signerReady, createSigner } = useParaSigner();
  const { data: company } = useGetMyCompany();
  const { data: multisigAccounts } = useListAccountsByCompany(company?.id);

  const [multisigClient, setMultisigClient] = useState<MultisigClient | null>(null);
  const [psmCommitment, setPsmCommitment] = useState("");
  const [psmPublicKey, setPsmPublicKey] = useState<string | undefined>(undefined);
  const [psmStatus, setPsmStatus] = useState<PSMStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [accountCacheMap, setAccountCacheMap] = useState<Map<string, AccountCache>>(new Map());

  const connectingRef = useRef(false);
  const retryCountRef = useRef(0);
  const syncRef = useRef(false);
  const syncPausedRef = useRef(false);
  const loadingRef = useRef(false);
  const loadedMultisigsRef = useRef<Map<string, Multisig>>(new Map());
  const loadedSetRef = useRef<Set<string>>(new Set());

  /** Enrich vault balances with token metadata and cache the SyncResult */
  const enrichAndCache = useCallback(
    async (accountId: string, syncResult: SyncResult) => {
      const { AccountId, Address, NetworkId } = await import("@miden-sdk/miden-sdk");

      const enrichedBalances: EnrichedBalance[] = [];
      for (const vb of syncResult.config.vaultBalances) {
        const faucetAccountId = AccountId.fromHex(vb.faucetId);
        const faucetBech32 = Address.fromAccountId(faucetAccountId).toBech32(NetworkId.testnet());

        // Try static lookup first (supportedTokens uses bech32 with optional _suffix)
        const knownToken = supportedTokens.find(t => faucetBech32.startsWith(t.faucetId.split("_")[0]));
        if (knownToken) {
          enrichedBalances.push({
            faucetId: vb.faucetId,
            faucetBech32,
            amount: vb.amount,
            symbol: knownToken.symbol,
            decimals: knownToken.decimals,
          });
        } else {
          // Fallback: resolve via WebClient (getFaucetMetadata has promise cache)
          let symbol = "UNKNOWN";
          let decimals = 8;
          if (webClient) {
            try {
              const meta = await getFaucetMetadata(webClient, vb.faucetId);
              symbol = meta.symbol;
              decimals = meta.decimals;
            } catch {
              /* keep defaults */
            }
          }
          enrichedBalances.push({ faucetId: vb.faucetId, faucetBech32, amount: vb.amount, symbol, decimals });
        }
      }

      setAccountCacheMap(prev => {
        const next = new Map(prev);
        next.set(accountId.toLowerCase(), { syncResult, enrichedBalances });
        return next;
      });
    },
    [webClient],
  );

  const connectToPsm = useCallback(
    async (client?: any): Promise<void> => {
      setPsmStatus("connecting");
      setError(null);
      try {
        const wc = client ?? webClient;
        if (!wc) {
          console.warn("[PSMProvider] No WebClient available, skipping PSM connection");
          return;
        }

        console.log("[PSMProvider] Connecting to PSM...", { endpoint: PSM_ENDPOINT });

        const { MultisigClient: MultisigClientClass } = await import("@openzeppelin/miden-multisig-client");
        const msClient = new MultisigClientClass(wc, { psmEndpoint: PSM_ENDPOINT });
        const { psmCommitment: commitment, psmPublicKey: pubkey } = await msClient.initialize("ecdsa");

        console.log("[PSMProvider] Connected to PSM", { commitment, pubkey: pubkey?.slice(0, 20) });

        setPsmCommitment(commitment);
        setPsmPublicKey(pubkey);
        setMultisigClient(msClient);
        setPsmStatus("connected");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to connect to PSM";
        console.error("[PSMProvider] Failed to connect to PSM:", err);
        setPsmStatus("error");
        setPsmCommitment("");
        setPsmPublicKey(undefined);
        setError(`Failed to connect to PSM: ${msg}`);
      }
    },
    [webClient],
  );

  // Auto-connect to PSM when WebClient becomes available (with retry on error)
  useEffect(() => {
    if (!webClient || connectingRef.current || multisigClient) return;

    // If in error state, retry up to 3 times with a delay
    if (psmStatus === "error") {
      if (retryCountRef.current >= 3) {
        console.warn("[PSMProvider] Max PSM connection retries reached");
        return;
      }
      const timer = setTimeout(() => {
        connectingRef.current = true;
        retryCountRef.current++;
        console.log(`[PSMProvider] Retrying PSM connection (attempt ${retryCountRef.current})...`);
        connectToPsm(webClient).finally(() => {
          connectingRef.current = false;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }

    connectingRef.current = true;
    retryCountRef.current = 0;
    console.log("[PSMProvider] WebClient available, initiating PSM connection...");
    connectToPsm(webClient).finally(() => {
      connectingRef.current = false;
    });
  }, [webClient, connectToPsm, multisigClient, psmStatus]);

  /** Register a loaded Multisig for auto-sync, optionally caching initial SyncResult */
  const registerMultisig = useCallback(
    (accountId: string, multisig: Multisig, syncResult?: SyncResult) => {
      loadedMultisigsRef.current.set(accountId.toLowerCase(), multisig);
      if (syncResult) {
        enrichAndCache(accountId, syncResult);
      }
    },
    [enrichAndCache],
  );

  /** Get an already-loaded Multisig instance by account ID */
  const getMultisig = useCallback((accountId: string): Multisig | undefined => {
    const normalized = accountId.toLowerCase();
    return loadedMultisigsRef.current.get(normalized);
  }, []);

  /** Pause auto-sync (call before execution to avoid concurrent PSM requests) */
  const pauseSync = useCallback(() => {
    syncPausedRef.current = true;
  }, []);

  /** Resume auto-sync (call after execution completes) */
  const resumeSync = useCallback(() => {
    syncPausedRef.current = false;
  }, []);

  /**
   * Auto-load all company multisig accounts into PSM.
   * Reference: private-state-manager/examples/web/src/App.tsx handleLoad
   */
  const loadAllAccounts = useCallback(async () => {
    if (
      !multisigClient ||
      !signerReady ||
      !multisigAccounts ||
      multisigAccounts.length === 0 ||
      psmStatus !== "connected" ||
      loadingRef.current
    ) {
      console.log("[PSMProvider] loadAllAccounts skipped:", {
        hasClient: !!multisigClient,
        signerReady,
        accounts: multisigAccounts?.length ?? 0,
        psmStatus,
        loading: loadingRef.current,
      });
      return;
    }

    loadingRef.current = true;

    try {
      // Sync WebClient with Miden node first so local store has latest on-chain state
      // (important for second cosigner who may not have notes/state synced yet)
      if (webClient) {
        try {
          await webClient.syncState();
        } catch {
          // Retry once after a short delay
          await new Promise(resolve => setTimeout(resolve, 500));
          await webClient.syncState();
        }
      }

      const signer = await createSigner();

      for (const account of multisigAccounts) {
        const rawId = account.accountId;
        if (loadedSetRef.current.has(rawId)) continue;

        try {
          let normalizedId = rawId;
          if (!normalizedId.startsWith("0x")) {
            normalizedId = `0x${normalizedId}`;
          }

          // Load from PSM (reference: loadMultisigAccount)
          const multisig = await multisigClient.load(normalizedId, signer);
          if (psmPublicKey) multisig.setPsmPublicKey(psmPublicKey);

          // Sync proposals, state, and consumable notes (reference: ms.syncAll())
          const syncResult = await multisig.syncAll();

          console.log("[PSMProvider] loadAllAccounts result:", {
            accountId: normalizedId,
            proposals: syncResult.proposals?.length ?? 0,
            notes: syncResult.notes?.length ?? 0,
            vaultBalances: syncResult.config?.vaultBalances?.length ?? 0,
            balanceDetails: syncResult.config?.vaultBalances?.map((vb: any) => ({
              faucetId: vb.faucetId,
              amount: String(vb.amount),
            })),
            noteDetails: syncResult.notes?.map((n: any) => ({
              id: n.id,
              assets: n.assets?.map((a: any) => ({ faucetId: a.faucetId, amount: String(a.amount) })),
            })),
          });

          // Register for periodic auto-sync + cache initial SyncResult
          registerMultisig(normalizedId, multisig, syncResult);

          loadedSetRef.current.add(rawId);
          console.log(`[PSMProvider] Loaded & synced: ${rawId}`);
        } catch (err: any) {
          const message = err?.message || String(err);
          console.warn(`[PSMProvider] Failed to load ${rawId}:`, message);
        }
      }
    } catch (err) {
      console.error("[PSMProvider] Auto-load failed:", err);
    } finally {
      loadingRef.current = false;
    }
  }, [webClient, multisigClient, psmPublicKey, psmStatus, signerReady, multisigAccounts, createSigner, registerMultisig]);

  // Auto-load accounts when PSM is connected and signer + account data are available
  useEffect(() => {
    if (multisigClient && signerReady && psmStatus === "connected" && multisigAccounts && multisigAccounts.length > 0) {
      loadAllAccounts();
    }
  }, [multisigClient, signerReady, psmStatus, multisigAccounts, loadAllAccounts]);

  /**
   * Full sync matching the reference handleSync pattern:
   * 1. webClient.syncState() — sync with Miden node
   * 2. multisig.syncAll() for each registered multisig — capture SyncResult into cache
   */
  const sync = useCallback(async () => {
    if (!webClient || syncRef.current || syncPausedRef.current) return;
    syncRef.current = true;
    setError(null);
    setSyncWarning(null);

    try {
      // Sync WebClient state with Miden node (retry on failure)
      try {
        await webClient.syncState();
      } catch {
        await new Promise(resolve => setTimeout(resolve, 500));
        await webClient.syncState();
      }

      // Sync all registered multisig instances and capture results
      for (const [accountId, multisig] of loadedMultisigsRef.current.entries()) {
        try {
          const syncResult = await multisig.syncAll();
          await enrichAndCache(accountId, syncResult);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("account nonce is too low to import")) {
            setSyncWarning(
              "Sync warning: local state is ahead of the on-chain state. " +
                "This can happen right after executing a transaction. Please wait a moment and sync again.",
            );
          } else {
            console.warn(`[PSMProvider] Failed to sync multisig ${accountId}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn("[PSMProvider] Auto-sync failed:", err);
    } finally {
      syncRef.current = false;
    }
  }, [webClient, enrichAndCache]);

  // Auto-sync at PSM_SYNC_INTERVAL
  useEffect(() => {
    if (!webClient || psmStatus !== "connected") return;

    const interval = setInterval(() => {
      sync();
    }, PSM_SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [webClient, psmStatus, sync]);

  const reconnect = useCallback(async () => {
    connectingRef.current = false;
    retryCountRef.current = 0;
    loadingRef.current = false;
    loadedSetRef.current.clear();
    setMultisigClient(null);
    loadedMultisigsRef.current.clear();
    setAccountCacheMap(new Map());
    await connectToPsm();
  }, [connectToPsm]);

  const value: PSMContextType = {
    multisigClient,
    psmCommitment,
    psmPublicKey,
    psmStatus,
    error,
    syncWarning,
    reconnect,
    registerMultisig,
    getMultisig,
    pauseSync,
    resumeSync,
    sync,
    accountCacheMap,
  };

  return <PSMContext.Provider value={value}>{children}</PSMContext.Provider>;
}

export function usePSMProvider() {
  const context = useContext(PSMContext);
  if (context === undefined) {
    throw new Error("usePSMProvider must be used within a PSMProvider");
  }
  return context;
}
