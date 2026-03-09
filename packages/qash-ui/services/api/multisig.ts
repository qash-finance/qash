import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiServerWithAuth } from "./index";
import { QASH_TOKEN_ADDRESS, QASH_TOKEN_DECIMALS } from "../utils/constant";
import { useMidenProvider } from "@/contexts/MidenProvider";
import { usePSMProvider } from "@/contexts/PSMProvider";
import { useParaSigner } from "@/hooks/web3/useParaSigner";
import { mintTokensViaClient } from "../utils/mint";
import { supportedTokens } from "../utils/supportedToken";
import { withTimeout, withRetry } from "../utils/async";
import type {
  CreateMultisigAccountDto,
  MultisigAccountResponseDto,
  CreateConsumeProposalDto,
  CreateSendProposalDto,
  CreateBatchSendProposalDto,
  CreateProposalFromBillsDto,
  MintTokensDto,
  MultisigProposalResponseDto,
  SubmitSignatureDto,
  SubmitRejectionDto,
  ExecuteTransactionResponseDto,
} from "@qash/types/dto/multisig";

// ==========================================================================
// Type Definitions
// ==========================================================================

export interface ConsumableNoteAsset {
  faucet_id: string;
  faucet_bech32: string;
  symbol: string;
  decimals: number;
  amount: number | string;
}

export interface ConsumableNote {
  note_id: string;
  assets: ConsumableNoteAsset[];
  sender: string;
  note_type: string;
}

// ==========================================================================
// Account API
// ==========================================================================

// POST: Create a new multisig account
export const createMultisigAccount = async (data: CreateMultisigAccountDto): Promise<MultisigAccountResponseDto> => {
  return apiServerWithAuth.postData<MultisigAccountResponseDto>(`/multisig/accounts`, data);
};

// GET: Get a multisig account by accountId (bech32)
export const getMultisigAccount = async (accountId: string): Promise<MultisigAccountResponseDto> => {
  return apiServerWithAuth.getData<MultisigAccountResponseDto>(`/multisig/accounts/${accountId}`);
};

// GET: List all multisig accounts for a company
export const listAccountsByCompany = async (companyId: number): Promise<MultisigAccountResponseDto[]> => {
  return apiServerWithAuth.getData<MultisigAccountResponseDto[]>(`/multisig/companies/${companyId}/accounts`);
};

// GET: List members for a multisig account
export const getAccountMembers = async (accountId: string) => {
  return apiServerWithAuth.getData<{ members: any[] }>(`/multisig/accounts/${accountId}/members`);
};

// ==========================================================================
// Proposal API
// ==========================================================================

// POST: Create a consume notes proposal
export const createConsumeProposal = async (data: CreateConsumeProposalDto): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(`/multisig/proposals/consume`, data);
};

// POST: Create a send funds proposal
export const createSendProposal = async (data: CreateSendProposalDto): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(`/multisig/proposals/send`, data);
};

// POST: Create a batch send funds proposal with multiple recipients
export const createBatchSendProposal = async (
  data: CreateBatchSendProposalDto,
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(`/multisig/proposals/send-batch`, data);
};

// POST: Create a proposal from bills (multi-signature bill payment)
export const createProposalFromBills = async (
  data: CreateProposalFromBillsDto,
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(`/multisig/proposals/from-bills`, data);
};

// GET: Get a proposal by ID
export const getProposal = async (proposalId: number): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.getData<MultisigProposalResponseDto>(`/multisig/proposals/${proposalId}`);
};

// GET: List all proposals for an account
export const listProposals = async (accountId: string): Promise<MultisigProposalResponseDto[]> => {
  return apiServerWithAuth.getData<MultisigProposalResponseDto[]>(`/multisig/accounts/${accountId}/proposals`);
};

// GET: List all proposals for a company (across all multisig accounts)
export const listProposalsByCompany = async (companyId: number): Promise<MultisigProposalResponseDto[]> => {
  return apiServerWithAuth.getData<MultisigProposalResponseDto[]>(`/multisig/companies/${companyId}/proposals`);
};

// POST: Submit a signature for a proposal
export const submitSignature = async (
  proposalId: number,
  data: SubmitSignatureDto,
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(`/multisig/proposals/${proposalId}/signatures`, data);
};

// POST: Submit a rejection for a proposal
export const submitRejection = async (
  proposalId: number,
  data: SubmitRejectionDto,
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(`/multisig/proposals/${proposalId}/rejections`, data);
};

// POST: Mark a proposal as executed (after frontend PSM execution)
export const markProposalExecuted = async (
  proposalId: number,
  transactionId?: string,
): Promise<ExecuteTransactionResponseDto> => {
  return apiServerWithAuth.postData<ExecuteTransactionResponseDto>(
    `/multisig/proposals/${proposalId}/mark-executed`,
    { transactionId },
  );
};

// POST: Cancel a proposal (deletes signatures, unlinks bills)
export const cancelProposal = async (proposalUuid: string): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(`/multisig/proposals/${proposalUuid}/cancel`);
};

// ==========================================================================
// Test / Dev
// ==========================================================================

// POST: Create a test company (development only)
export const createTestCompany = async () => {
  return apiServerWithAuth.postData<any>(`/multisig/test/create-company`);
};

// ==========================================================================
// React Query Hooks
// ==========================================================================

/**
 * React Query hook to create a multisig account
 */
export function useCreateMultisigAccount() {
  const queryClient = useQueryClient();

  return useMutation<MultisigAccountResponseDto, Error, CreateMultisigAccountDto>({
    mutationFn: data => createMultisigAccount(data),
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ["multisig", "accounts"] });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "companies", data.companyId, "accounts"],
      });
    },
  });
}

/**
 * React Query hook to get a multisig account
 */
export function useGetMultisigAccount(accountId?: string, options?: { enabled?: boolean }) {
  return useQuery<MultisigAccountResponseDto>({
    queryKey: ["multisig", "accounts", accountId],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return getMultisigAccount(accountId);
    },
    enabled: !!accountId && options?.enabled !== false,
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to list multisig accounts by company
 */
export function useListAccountsByCompany(companyId?: number, options?: { enabled?: boolean }) {
  return useQuery<MultisigAccountResponseDto[]>({
    queryKey: ["multisig", "companies", companyId, "accounts"],
    queryFn: () => {
      if (!companyId) throw new Error("companyId is required");
      return listAccountsByCompany(companyId);
    },
    enabled: !!companyId && options?.enabled !== false,
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Reads consumable notes from PSMProvider cache (populated by PSMProvider auto-load + periodic sync).
 * Enriches note assets with bech32 faucet IDs and token symbols from the enrichedBalances cache.
 */
export function useGetConsumableNotes(accountId?: string, _options?: { enabled?: boolean }) {
  const { accountCacheMap, sync } = usePSMProvider();
  const [enrichedNotes, setEnrichedNotes] = useState<ConsumableNote[]>([]);

  const key = accountId
    ? (accountId.toLowerCase().startsWith("0x") ? accountId.toLowerCase() : `0x${accountId}`.toLowerCase())
    : "";
  const cache = key ? accountCacheMap.get(key) : undefined;
  const rawNotes = cache?.syncResult.notes;
  const enrichedBalances = cache?.enrichedBalances;

  // Build notes with enrichment: first from cache, then async bech32 conversion for unmatched assets
  useEffect(() => {
    if (!rawNotes) {
      setEnrichedNotes([]);
      return;
    }

    let cancelled = false;

    (async () => {
      const { AccountId, Address, NetworkId } = await import("@miden-sdk/miden-sdk");

      const notes: ConsumableNote[] = await Promise.all(
        rawNotes.map(async note => ({
          note_id: note.id,
          assets: await Promise.all(
            note.assets.map(async a => {
              // Look up enriched metadata by hex faucet ID from vault balances
              const enriched = enrichedBalances?.find(
                eb => eb.faucetId.toLowerCase() === a.faucetId.toLowerCase(),
              );
              if (enriched) {
                return {
                  faucet_id: a.faucetId,
                  faucet_bech32: enriched.faucetBech32,
                  symbol: enriched.symbol,
                  decimals: enriched.decimals,
                  amount: a.amount.toString(),
                };
              }

              // Fallback: convert hex to bech32 and match against supportedTokens
              try {
                const faucetAccountId = AccountId.fromHex(a.faucetId);
                const faucetBech32 = Address.fromAccountId(faucetAccountId).toBech32(NetworkId.testnet());
                const knownToken = supportedTokens.find(t => {
                  const base = t.faucetId.split("_")[0];
                  return faucetBech32.startsWith(base);
                });
                return {
                  faucet_id: a.faucetId,
                  faucet_bech32: faucetBech32,
                  symbol: knownToken?.symbol || "",
                  decimals: knownToken?.decimals ?? 8,
                  amount: a.amount.toString(),
                };
              } catch {
                return {
                  faucet_id: a.faucetId,
                  faucet_bech32: "",
                  symbol: "",
                  decimals: 8,
                  amount: a.amount.toString(),
                };
              }
            }),
          ),
          sender: "",
          note_type: "",
        })),
      );

      if (!cancelled) {
        setEnrichedNotes(notes);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawNotes, enrichedBalances]);

  return useMemo(
    () => ({ data: { notes: enrichedNotes }, isLoading: !!accountId && !cache, refetch: sync }),
    [enrichedNotes, accountId, cache, sync],
  );
}

/**
 * Reads per-account balances from PSMProvider cache (populated by PSMProvider auto-load + periodic sync).
 * Returns same shape as the old useQuery-based hook for backward compatibility.
 */
export function useLocalAccountBalances(accountIds?: string[], _options?: { enabled?: boolean }) {
  const { accountCacheMap } = usePSMProvider();

  return useMemo(() => {
    const accounts = (accountIds || []).map(id => {
      const key = id.toLowerCase().startsWith("0x") ? id.toLowerCase() : `0x${id}`.toLowerCase();
      const cache = accountCacheMap.get(key);
      if (!cache) return { accountId: id, balance: 0 };
      const balance = cache.enrichedBalances.reduce(
        (sum, b) => sum + Number(b.amount) / Math.pow(10, b.decimals),
        0,
      );
      return { accountId: id, balance };
    });
    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    return { data: { totalBalance, accounts }, isLoading: !!accountIds?.length && accountCacheMap.size === 0 };
  }, [accountIds, accountCacheMap]);
}

/**
 * Reads detailed token assets from PSMProvider cache (populated by PSMProvider auto-load + periodic sync).
 * Aggregates across all provided accounts. Returns same shape as the old useQuery-based hook.
 */
export function useMultisigAssets(accountIds?: string[], _options?: { enabled?: boolean }) {
  const { accountCacheMap } = usePSMProvider();

  return useMemo(() => {
    const assetMap = new Map<string, { amount: bigint; decimals: number; symbol: string }>();

    for (const id of accountIds || []) {
      const key = id.toLowerCase().startsWith("0x") ? id.toLowerCase() : `0x${id}`.toLowerCase();
      const cache = accountCacheMap.get(key);
      if (!cache) continue;
      for (const b of cache.enrichedBalances) {
        const existing = assetMap.get(b.faucetBech32);
        if (existing) {
          existing.amount += b.amount;
        } else {
          assetMap.set(b.faucetBech32, { amount: b.amount, decimals: b.decimals, symbol: b.symbol });
        }
      }
    }

    // Ensure QASH token is always present
    if (!Array.from(assetMap.values()).find(v => v.symbol === "QASH")) {
      assetMap.set(QASH_TOKEN_ADDRESS, { amount: BigInt(0), decimals: QASH_TOKEN_DECIMALS, symbol: "QASH" });
    }

    const balances = Array.from(assetMap.entries()).map(([assetId, { amount, decimals, symbol }]) => ({
      assetId,
      balance: (Number(amount) / Math.pow(10, decimals)).toString(),
      decimals,
      symbol,
    }));

    const totalUsd = balances.reduce((sum, b) => sum + (parseFloat(b.balance) || 0), 0);

    return { data: { balances, totalUsd }, isLoading: !!accountIds?.length && accountCacheMap.size === 0 };
  }, [accountIds, accountCacheMap]);
}

/**
 * React Query hook to list account members
 */
export function useGetAccountMembers(accountId?: string, options?: { enabled?: boolean }) {
  return useQuery<{ members: any[] }>({
    queryKey: ["multisig", "accounts", accountId, "members"],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return getAccountMembers(accountId);
    },
    enabled: !!accountId && options?.enabled !== false,
    staleTime: 10000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to mint tokens to a multisig account via WebClient
 */
export function useMintTokens() {
  const queryClient = useQueryClient();
  const { client } = useMidenProvider();

  return useMutation<{ transactionId: string }, Error, { accountId: string; data: MintTokensDto }>({
    mutationFn: async params => {
      if (!client) throw new Error("WebClient not initialized");
      const transactionId = await mintTokensViaClient(
        client,
        params.accountId,
        params.data.faucetId,
        BigInt(params.data.amount),
      );
      return { transactionId };
    },
    onSuccess: (_data, params) => {
      // Invalidate account balances
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", params.accountId, "balances"],
      });
    },
  });
}

/**
 * React Query hook to create a consume proposal via MultisigClient (PSM) + store metadata on backend.
 * Reference: private-state-manager/examples/web/src/App.tsx handleCreateConsumeNotesProposal
 */
export function useCreateConsumeProposal() {
  const queryClient = useQueryClient();
  const { psmPublicKey, registerMultisig, getMultisig, pauseSync, resumeSync, ensureConnected } = usePSMProvider();
  const { isReady: signerReady, createSigner } = useParaSigner();

  return useMutation<MultisigProposalResponseDto, Error, CreateConsumeProposalDto>({
    mutationFn: async data => {
      const multisigClient = await ensureConnected();
      if (!signerReady) throw new Error("Para signer not ready");

      const normalizedId = data.accountId.startsWith("0x") ? data.accountId : `0x${data.accountId}`;

      // Pause auto-sync to prevent concurrent PSM requests
      pauseSync();

      try {
        // 1. Reuse already-loaded Multisig instance
        let multisig = getMultisig(normalizedId);
        if (!multisig) {
          const signer = await createSigner();
          multisig = await multisigClient.load(normalizedId, signer);
          if (psmPublicKey) multisig.setPsmPublicKey(psmPublicKey);
          registerMultisig(normalizedId, multisig);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        const { proposal } = await withRetry(
          () => withTimeout(multisig!.createConsumeNotesProposal(data.noteIds), 30_000),
          {
            maxRetries: 2,
            onRetry: (attempt) => console.warn(`[useCreateConsumeProposal] Retry ${attempt} after timeout`),
          },
        );

        // 2. Store metadata on backend (PSM stores limited data)
        return createConsumeProposal({
          ...data,
          psmProposalId: proposal.id,
          summaryCommitment: proposal.commitment,
          summaryBytesHex: proposal.txSummary,
          requestBytesHex: "",
        });
      } finally {
        resumeSync();
      }
    },
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "notes"],
      });
    },
  });
}

/**
 * React Query hook to create a send proposal
 */
export function useCreateSendProposal() {
  const queryClient = useQueryClient();

  return useMutation<MultisigProposalResponseDto, Error, CreateSendProposalDto>({
    mutationFn: data => createSendProposal(data),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
    },
  });
}

/**
 * React Query hook to create a batch send proposal with multiple recipients
 */
export function useCreateBatchSendProposal() {
  const queryClient = useQueryClient();

  return useMutation<MultisigProposalResponseDto, Error, CreateBatchSendProposalDto>({
    mutationFn: data => createBatchSendProposal(data),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
    },
  });
}

/**
 * React Query hook to create a proposal from bills (multi-signature bill payment).
 * Uses PSM MultisigClient to create the on-chain proposal, then records metadata on the backend.
 */
export function useCreateProposalFromBills() {
  const queryClient = useQueryClient();
  const { psmPublicKey, registerMultisig, getMultisig, pauseSync, resumeSync, ensureConnected } = usePSMProvider();
  const { client: webClient } = useMidenProvider();
  const { isReady: signerReady, createSigner } = useParaSigner();

  return useMutation<MultisigProposalResponseDto, Error, CreateProposalFromBillsDto>({
    mutationFn: async data => {
      const multisigClient = await ensureConnected();
      if (!webClient) throw new Error("WebClient not initialized");
      if (!signerReady) throw new Error("Para signer not ready");
      if (!data.payments || data.payments.length === 0) {
        throw new Error("Payments array is required for bill proposals");
      }

      const { bech32ToHex, buildBatchP2idTransactionRequest, uint8ArrayToBase64 } = await import(
        "@/services/utils/miden/batchSend"
      );
      const accountIdHex = data.accountId.startsWith("0x")
        ? data.accountId
        : await bech32ToHex(data.accountId);
      const normalizedId = accountIdHex.startsWith("0x") ? accountIdHex : `0x${accountIdHex}`;

      // Pause auto-sync to prevent concurrent PSM requests
      pauseSync();

      try {
      // 1. Reuse already-loaded Multisig instance
      let multisig = getMultisig(normalizedId);
      if (!multisig) {
        const signer = await createSigner();
        multisig = await multisigClient.load(normalizedId, signer);
        if (psmPublicKey) multisig.setPsmPublicKey(psmPublicKey);
        registerMultisig(normalizedId, multisig);
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      let psmProposalId: string;
      let summaryCommitment: string;
      let summaryBytesHex: string;

      if (data.payments.length === 1) {
        // Single recipient: use typed createSendProposal (produces p2id metadata)
        const p = data.payments[0];
        console.log("[useCreateProposalFromBills] recipientId:", p.recipientId, "faucetId:", p.faucetId);
        const recipientHex = await bech32ToHex(p.recipientId);
        const faucetHex = await bech32ToHex(p.faucetId);
        const { proposal } = await withRetry(
          () => withTimeout(multisig!.createSendProposal(recipientHex, faucetHex, BigInt(p.amount)), 30_000),
          {
            maxRetries: 2,
            onRetry: (attempt) => console.warn(`[useCreateProposalFromBills] Send proposal retry ${attempt} after timeout`),
          },
        );

        psmProposalId = proposal.id;
        summaryCommitment = proposal.commitment;
        summaryBytesHex = proposal.txSummary;
      } else {
        // Batch: build custom request with multiple P2ID output notes
        const recipients = await Promise.all(
          data.payments.map(async p => ({
            recipientHex: await bech32ToHex(p.recipientId),
            faucetHex: await bech32ToHex(p.faucetId),
            amount: BigInt(p.amount),
          })),
        );

        const { request, saltHex } = await buildBatchP2idTransactionRequest(
          normalizedId,
          recipients,
        );

        // Simulate transaction to get summary
        const { executeForSummary } = await import("@openzeppelin/miden-multisig-client");
        const summary = await executeForSummary(webClient, normalizedId, request);
        const summaryBase64 = uint8ArrayToBase64(summary.serialize());

        // Create proposal on PSM. PSM stores standard p2id metadata (first recipient + total).
        // Batch recipients are stored in our backend metadata for execution.
        const firstRecipient = recipients[0];
        const totalAmount = recipients.reduce((sum, r) => sum + r.amount, BigInt(0));
        const proposal = await withRetry(
          () => withTimeout(multisig!.createProposal(Date.now(), summaryBase64, {
            proposalType: "p2id" as const,
            recipientId: firstRecipient.recipientHex,
            faucetId: firstRecipient.faucetHex,
            amount: totalAmount.toString(),
            description: data.description || `Batch send to ${recipients.length} recipients`,
            saltHex,
          }), 30_000),
          {
            maxRetries: 2,
            onRetry: (attempt) => console.warn(`[useCreateProposalFromBills] Batch proposal retry ${attempt} after timeout`),
          },
        );

        psmProposalId = proposal.id;
        summaryCommitment = proposal.commitment;
        summaryBytesHex = proposal.txSummary;
      }

      // 2. Record proposal on backend (links bills, updates statuses)
      return createProposalFromBills({
        ...data,
        psmProposalId,
        summaryCommitment,
        summaryBytesHex,
        requestBytesHex: "",
      });
      } finally {
        resumeSync();
      }
    },
    onSuccess: data => {
      // Invalidate both bills and multisig proposals
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "proposals"],
      });
    },
  });
}

/**
 * React Query hook to get a proposal
 */
export function useGetProposal(proposalId?: number, options?: { enabled?: boolean }) {
  return useQuery<MultisigProposalResponseDto>({
    queryKey: ["multisig", "proposals", proposalId],
    queryFn: () => {
      if (proposalId === undefined) throw new Error("proposalId is required");
      return getProposal(proposalId);
    },
    enabled: proposalId !== undefined && options?.enabled !== false,
    staleTime: 10000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to list proposals for an account
 */
export function useListProposals(accountId?: string, options?: { enabled?: boolean }) {
  return useQuery<MultisigProposalResponseDto[]>({
    queryKey: ["multisig", "accounts", accountId, "proposals"],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return listProposals(accountId);
    },
    enabled: !!accountId && options?.enabled !== false,
    staleTime: 10000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to list proposals for a company (across all multisig accounts)
 */
export function useListProposalsByCompany(companyId?: number, options?: { enabled?: boolean }) {
  return useQuery<MultisigProposalResponseDto[]>({
    queryKey: ["multisig", "companies", companyId, "proposals"],
    queryFn: () => {
      if (!companyId) throw new Error("companyId is required");
      return listProposalsByCompany(companyId);
    },
    enabled: !!companyId && options?.enabled !== false,
    staleTime: 10000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to sign a proposal via PSM MultisigClient + sync signature to backend.
 * Reference: private-state-manager/examples/web/src/App.tsx handleSignProposal
 *
 * Flow:
 *  1. Load multisig from PSM
 *  2. multisig.signTransactionProposal(commitment) — triggers Para wallet popup via ParaSigner
 *  3. Extract the new signature from the returned proposals
 *  4. Submit the signature to the backend for metadata sync
 */
export function useSignProposal() {
  const queryClient = useQueryClient();
  const { psmPublicKey, registerMultisig, getMultisig, pauseSync, resumeSync, ensureConnected } = usePSMProvider();
  const { client: webClient } = useMidenProvider();
  const { isReady: signerReady, createSigner, commitment: signerCommitment } = useParaSigner();

  return useMutation<
    MultisigProposalResponseDto,
    Error,
    { proposal: MultisigProposalResponseDto; accountPublicKeys: string[] }
  >({
    mutationFn: async ({ proposal, accountPublicKeys }) => {
      const multisigClient = await ensureConnected();
      if (!signerReady || !signerCommitment) throw new Error("Para signer not ready");

      const commitmentToSign = proposal.summaryCommitment;
      if (!commitmentToSign) throw new Error("Proposal missing summaryCommitment");

      const normalizedId = proposal.accountId.startsWith("0x")
        ? proposal.accountId
        : `0x${proposal.accountId}`;

      // Pause auto-sync to prevent concurrent PSM requests
      pauseSync();

      try {
        // 1. Reuse already-loaded Multisig instance
        let multisig = getMultisig(normalizedId);
        if (!multisig) {
          const signer = await createSigner();
          multisig = await multisigClient.load(normalizedId, signer);
          if (psmPublicKey) multisig.setPsmPublicKey(psmPublicKey);
          registerMultisig(normalizedId, multisig);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        const { resilientSyncAll } = await import("@/services/utils/miden/sync");
        if (!webClient) throw new Error("WebClient not initialized");
        const syncResult = await withRetry(
          () => withTimeout(resilientSyncAll(multisig!, webClient!), 30_000),
          {
            maxRetries: 2,
            onRetry: (attempt) => console.warn(`[useSignProposal] Sync retry ${attempt} after timeout`),
          },
        );
        const syncedProposals = syncResult.proposals;

        // 2. Check if we already signed this proposal on PSM
        const normalizedSigner = signerCommitment.toLowerCase();
        const existingPsmProposal = syncedProposals.find(p => p.commitment === commitmentToSign);
        const alreadySigned = existingPsmProposal?.signatures.some(
          s => s.signerId.toLowerCase() === normalizedSigner,
        );

        let signedProposal = existingPsmProposal;

        if (!alreadySigned) {
          // 3a. Not yet signed — sign on PSM (ParaSigner triggers Para wallet popup)
          const updatedProposals = await withRetry(
            () => withTimeout(multisig!.signTransactionProposal(commitmentToSign), 30_000),
            {
              maxRetries: 2,
              onRetry: (attempt) => console.warn(`[useSignProposal] Sign retry ${attempt} after timeout`),
            },
          );
          signedProposal = updatedProposals.find(p => p.commitment === commitmentToSign);
        }

        if (!signedProposal) throw new Error("Signed proposal not found in PSM response");

        // 4. Extract our signature
        const ourSig = signedProposal.signatures.find(s => s.signerId.toLowerCase() === normalizedSigner);
        if (!ourSig) throw new Error("Our signature not found in PSM response");

        // 5. Compute approver index by matching signer commitment against account public keys
        const normalizedCommitment = signerCommitment.toLowerCase().replace(/^0x/, "");
        const approverIndex = accountPublicKeys.findIndex(
          pk => pk.toLowerCase().replace(/^0x/, "") === normalizedCommitment,
        );
        if (approverIndex === -1) throw new Error("Your signer commitment is not an approver on this multisig account");

        // 6. Submit signature to backend for metadata sync (upsert — safe to call even if already stored)
        return submitSignature(proposal.id, {
          approverIndex,
          approverPublicKey: signerCommitment,
          signatureHex: ourSig.signature.signature,
        });
      } finally {
        resumeSync();
      }
    },
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "proposals", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "companies"],
      });
    },
  });
}

/**
 * React Query hook to submit a signature for a proposal (legacy — direct backend submission)
 */
export function useSubmitSignature() {
  const queryClient = useQueryClient();

  return useMutation<MultisigProposalResponseDto, Error, { proposalId: number; data: SubmitSignatureDto }>({
    mutationFn: ({ proposalId, data }) => submitSignature(proposalId, data),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "proposals", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
    },
  });
}

/**
 * React Query hook to submit a rejection for a proposal
 */
export function useSubmitRejection() {
  const queryClient = useQueryClient();

  return useMutation<MultisigProposalResponseDto, Error, { proposalId: number; data: SubmitRejectionDto }>({
    mutationFn: ({ proposalId, data }) => submitRejection(proposalId, data),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "proposals", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
    },
  });
}

/**
 * React Query hook to execute a proposal via PSM MultisigClient.
 *
 * Flow:
 *  1. Load multisig from PSM + sync proposals
 *  2. Execute on-chain via multisig.executeTransactionProposal(commitment)
 *     — OR for batch sends: custom execution via executeBatchProposal
 *  3. Mark proposal as executed on the backend (status + bills update)
 */
export function useExecuteProposal() {
  const queryClient = useQueryClient();
  const { psmCommitment, psmPublicKey, registerMultisig, getMultisig, pauseSync, resumeSync, ensureConnected } = usePSMProvider();
  const { client: webClient } = useMidenProvider();
  const { isReady: signerReady, createSigner } = useParaSigner();

  return useMutation<
    ExecuteTransactionResponseDto,
    Error,
    { proposalId: number; proposal: MultisigProposalResponseDto }
  >({
    mutationFn: async ({ proposalId, proposal }) => {
      const multisigClient = await ensureConnected();
      if (!webClient) throw new Error("WebClient not initialized");
      if (!signerReady) throw new Error("Para signer not ready");

      const commitment = proposal.summaryCommitment;
      if (!commitment) throw new Error("Proposal missing summaryCommitment");

      const normalizedId = proposal.accountId.startsWith("0x")
        ? proposal.accountId
        : `0x${proposal.accountId}`;

      // Pause auto-sync to prevent concurrent PSM requests (replay protection)
      pauseSync();

      try {
        // 1. Reuse already-loaded Multisig to avoid concurrent PSM auth conflicts
        let multisig = getMultisig(normalizedId);
        if (!multisig) {
          const signer = await createSigner();
          multisig = await multisigClient.load(normalizedId, signer);
          if (psmPublicKey) multisig.setPsmPublicKey(psmPublicKey);
          registerMultisig(normalizedId, multisig);
        }

        // Small delay to ensure any in-flight auto-sync requests complete
        await new Promise(resolve => setTimeout(resolve, 300));

        // Sync WebClient with Miden node first so local store has all notes.
        // Critical for consume_notes proposals: signer 2 needs the note in their
        // local store even though signer 1 created the proposal.
        await withRetry(
          () => withTimeout(webClient!.syncState(), 30_000),
          {
            maxRetries: 2,
            onRetry: (attempt) => console.warn(`[useExecuteProposal] syncState retry ${attempt} after timeout`),
          },
        );

        // syncAll() ensures the WebClient has the latest account state (signerCommitments,
        // threshold, psmCommitment) from PSM, which the MASM auth verifier needs.
        // Use resilientSyncAll to handle "nonce too low" when executing back-to-back.
        const { resilientSyncAll } = await import("@/services/utils/miden/sync");
        await withRetry(
          () => withTimeout(resilientSyncAll(multisig!, webClient!), 30_000),
          {
            maxRetries: 2,
            onRetry: (attempt) => console.warn(`[useExecuteProposal] resilientSyncAll retry ${attempt} after timeout`),
          },
        );

        // 2. Check if this is a batch proposal (multiple recipients from backend metadata)
        const isBatch = (proposal.payments?.length ?? 0) > 1;

        try {
          if (isBatch) {
            // Batch execution: the OZ library's executeTransactionProposal only supports
            // single-recipient P2ID. For batch sends, we use custom execution that rebuilds
            // the correct multi-recipient transaction.
            const { executeBatchProposal, bech32ToHex } = await import("@/services/utils/miden/batchSend");
            const batchRecipients = await Promise.all(
              proposal.payments!.map(async p => ({
                recipientHex: await bech32ToHex(p.recipientId),
                faucetHex: await bech32ToHex(p.faucetId),
                amount: p.amount.toString(),
              })),
            );
            await withRetry(
              () => withTimeout(executeBatchProposal({
                webClient,
                psmClient: multisigClient.psmClient,
                multisig,
                accountId: normalizedId,
                commitment,
                psmCommitment,
                psmPublicKey,
                batchRecipients,
              }), 60_000),
              {
                maxRetries: 2,
                onRetry: (attempt) => console.warn(`[useExecuteProposal] Batch execute retry ${attempt} after timeout`),
              },
            );
          } else {
            // Standard execution for single-recipient proposals
            await withRetry(
              () => withTimeout(multisig!.executeTransactionProposal(commitment), 60_000),
              {
                maxRetries: 2,
                onRetry: (attempt) => console.warn(`[useExecuteProposal] Execute retry ${attempt} after timeout`),
              },
            );
          }
        } catch (execErr: any) {
          const msg = execErr?.message || String(execErr);
          // Translate PSM-specific errors into user-friendly messages
          if (msg.includes("Commitment mismatch") || msg.includes("Previous commitment mismatch")) {
            throw new Error(
              "The account state has changed since this proposal was created (likely due to another " +
              "transaction being executed). Please cancel this proposal and create a new one.",
            );
          }
          if (msg.includes("non-canonical delta pending") || msg.includes("pending proposals")) {
            throw new Error(
              "A previous transaction is still being finalized on-chain. " +
              "Please wait a few minutes and try again.",
            );
          }
          throw execErr;
        }

        // 3. Mark as executed on backend (update status + bills)
        const execResult = await markProposalExecuted(proposalId);

        // 4. Sync WebClient with Miden node so the local account state reflects the
        //    new on-chain nonce. Without this, a subsequent execute would have syncState()
        //    overwrite the local (advanced) account with PSM's stale state, causing
        //    "account nonce is too low to import".
        try {
          await webClient.syncState();
        } catch (syncErr) {
          console.warn("[useExecuteProposal] Post-execution node sync failed (non-fatal):", syncErr);
        }

        return execResult;
      } finally {
        resumeSync();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multisig", "proposals"] });
      queryClient.invalidateQueries({ queryKey: ["multisig", "accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });
}

/**
 * React Query hook to cancel a proposal
 */
export function useCancelProposal() {
  const queryClient = useQueryClient();

  return useMutation<MultisigProposalResponseDto, Error, { proposalUuid: string }>({
    mutationFn: ({ proposalUuid }) => cancelProposal(proposalUuid),
    onSuccess: data => {
      // Invalidate company-wide proposals list
      queryClient.invalidateQueries({ queryKey: ["multisig", "proposals"] });

      // Invalidate account-specific proposals list
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });

      // Invalidate individual proposal query (fixes detail page showing stale data)
      queryClient.invalidateQueries({
        queryKey: ["multisig", "proposals", data.id],
      });

      // Invalidate bills list
      queryClient.invalidateQueries({ queryKey: ["bills"] });

      // Invalidate consumable notes (to remove notes from consume tab)
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "notes"],
      });
    },
  });
}
