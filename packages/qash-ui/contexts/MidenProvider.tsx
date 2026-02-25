"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useLogout, useModal, useWallet, Wallet } from "@getpara/react-sdk-lite";
import { useMiden } from "@/hooks/web3/useMiden";
import { getBalance } from "@/services/utils/getBalance";
import { NODE_ENDPOINT } from "@/services/utils/constant";
import { UseMutateAsyncFunction } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { trackEvent } from "@/services/analytics/posthog";
import { PostHogEvent } from "@/types/posthog";

interface BalanceData {
  balances: Array<{
    assetId: string;
    balance: string;
    decimals?: number;
    maxSupply?: number;
    symbol?: string;
  }>;
  totalUsd: number;
}

interface MidenContextType {
  isConnected: boolean;
  isLoading: boolean;
  wallet: Omit<Wallet, "signer"> | null | undefined;
  openModal: (config?: any) => void;
  logoutAsync: UseMutateAsyncFunction<
    void,
    Error,
    void | {
      clearPregenWallets?: boolean | undefined;
    },
    unknown
  >;
  client: any;
  address: string | undefined;
  balances: BalanceData | null;
  balancesLoading: boolean;
  fetchBalances: () => Promise<void>;
}

// Create the context
const MidenContext = createContext<MidenContextType | undefined>(undefined);

// Provider component
export function MidenProvider({ children }: { children: ReactNode }) {
  const { isConnected, isLoading } = useAccount();
  const { data: wallet } = useWallet();
  const { openModal } = useModal();
  const { logoutAsync } = useLogout();
  const { client, accountId: address } = useMiden(NODE_ENDPOINT);

  const isConsumingRef = useRef(false);
  const isFetchingRef = useRef(false);

  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [balancesLoading, setBalancesLoading] = useState<boolean>(false);

  // Use a stable reference for fetchBalances to avoid infinite re-render loops.
  // The actual implementation reads address/client from refs so the callback
  // identity never changes, preventing useEffect dependency churn.
  const addressRef = useRef(address);
  const clientRef = useRef(client);
  addressRef.current = address;
  clientRef.current = client;

  const fetchBalances = useCallback(async () => {
    const addr = addressRef.current;
    const cl = clientRef.current;
    if (!addr || !cl || isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      setBalancesLoading(true);
      console.log("Fetching balances for address:", addr);
      const fetchedBalances = await getBalance(cl, addr);
      console.log("Fetched balances", fetchedBalances);

      // Normalize the balances (fetchedBalances is already resolved)
      const normalizedBalances = fetchedBalances.map(asset => ({
        assetId: asset.assetId,
        balance: asset.balance,
        decimals: asset.decimals,
        symbol: asset.symbol,
      }));

      console.log("Normalized balances", normalizedBalances);

      // Calculate total USD (assuming 1 token = 1 USD)
      const totalUsd = normalizedBalances.reduce((sum, asset) => {
        const balance = parseFloat(asset.balance) || 0;
        return sum + balance;
      }, 0);

      setBalances({
        balances: normalizedBalances,
        totalUsd,
      });
    } catch (err) {
      console.error("Failed to fetch balances:", err);
      // Set empty balances on error to prevent UI from being stuck
      setBalances({
        balances: [],
        totalUsd: 0,
      });
    } finally {
      setBalancesLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch balances when address, client, or connection status changes
  useEffect(() => {
    if (isConnected && address && client) {
      trackEvent(PostHogEvent.WALLET_CONNECTED, { address });
      fetchBalances();
    }
  }, [isConnected, address, client, fetchBalances]);

  useEffect(() => {
    if (!client) return;

    const interval = setInterval(async () => {
      // Skip if consuming process is already running or if on invoice-review page
      const isOnInvoiceReview = typeof window !== "undefined" && window.location.pathname.includes("/invoice-review");

      if (isConsumingRef.current || isOnInvoiceReview) {
        return;
      }
      if (isConsumingRef.current) {
        return;
      }

      const { Address } = await import("@miden-sdk/miden-sdk");
      const to = await client.getAccount(Address.fromBech32(address).accountId());

      if (!to) {
        console.error("Destination account not found");
        return;
      }

      const mintedNotes = await client.getConsumableNotes(Address.fromBech32(address).accountId());

      if (mintedNotes.length === 0) return;

      // Set lock to prevent concurrent execution
      isConsumingRef.current = true;

      try {
        // toast
        toast.loading(`Found ${mintedNotes.length} consumable notes, consuming...`);
        const mintedNoteIds = mintedNotes.map(n => n.inputNoteRecord().id().toString());
        const consumeTxRequest = client.newConsumeTransactionRequest(mintedNoteIds as any);
        const consumeTxHash = await client.submitNewTransaction(to.id(), consumeTxRequest);
        await client.syncState();
        toast.dismiss();
        toast.success(`Consumed ${mintedNotes.length} consumable notes`);
      } catch (error) {
        console.error("Failed to consume notes:", error);
        toast.dismiss();
        toast.error("Failed to consume notes");
      } finally {
        // Release lock
        isConsumingRef.current = false;
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [client, address]);

  const value: MidenContextType = {
    isLoading,
    isConnected,
    wallet,
    openModal,
    logoutAsync,
    client,
    address,
    balances,
    balancesLoading,
    fetchBalances,
  };

  return <MidenContext.Provider value={value}>{children}</MidenContext.Provider>;
}

// Custom hook to use the context
export function useMidenProvider() {
  const context = useContext(MidenContext);
  if (context === undefined) {
    throw new Error("useMidenProvider must be used within a MidenProvider");
  }
  return context;
}
