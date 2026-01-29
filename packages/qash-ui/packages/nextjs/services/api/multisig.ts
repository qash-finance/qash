import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiServerWithAuth } from "./index";
import { QASH_TOKEN_ADDRESS, QASH_TOKEN_DECIMALS } from "../utils/constant";
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
  GetBatchAccountBalancesDto,
  GetBatchAccountBalancesResponseDto,
  AccountBalancesInfoDto,
  AccountBalanceStatDto,
  TokenStatDto,
} from "@qash/types/dto/multisig";

// ==========================================================================
// Type Definitions
// ==========================================================================

export interface ConsumableNoteAsset {
  faucet_id: string;
  amount: number | string;
}

export interface ConsumableNote {
  note_id: string;
  assets: ConsumableNoteAsset[];
  sender: string;
  note_type: string;
}

// ==========================================================================
// Helper Functions
// ==========================================================================

/**
 * Calculates balance statistics for an account
 * Groups tokens together, normalizes decimals, and calculates USD values
 */
function calculateAccountStats(balances: any[]): AccountBalanceStatDto {
  const tokenMap = new Map<string, { amount: number; symbol?: string }>();

  // Extract base QASH token address (without routing params after underscore)
  const baseQashAddress = QASH_TOKEN_ADDRESS.split('_')[0];

  // Group tokens by faucet_id
  for (const balance of balances) {
    const faucetId = balance.faucet_id;
    let amount = balance.amount;

    // Normalize QASH token by dividing by decimals
    const faucetIdBase = faucetId.split('_')[0];
    const isQashToken =
      faucetIdBase.toLowerCase() === baseQashAddress.toLowerCase() ||
      faucetId.toLowerCase() === QASH_TOKEN_ADDRESS.toLowerCase();

    if (isQashToken) {
      amount = amount / Math.pow(10, QASH_TOKEN_DECIMALS);
    }

    if (tokenMap.has(faucetId)) {
      const existing = tokenMap.get(faucetId)!;
      existing.amount += amount;
    } else {
      tokenMap.set(faucetId, {
        amount,
        symbol: isQashToken ? "QASH" : undefined,
      });
    }
  }

  // Convert to array and calculate USD values
  const tokens: TokenStatDto[] = Array.from(tokenMap.entries()).map(
    ([faucetId, { amount, symbol }]) => ({
      faucetId,
      symbol,
      amount,
      amountUSD: amount, // 1 token = $1
    })
  );

  // Calculate total USD value
  const totalUSD = tokens.reduce((sum, token) => sum + token.amountUSD, 0);

  return {
    totalUSD,
    tokens,
  };
}

// ==========================================================================
// Account API
// ==========================================================================

// POST: Create a new multisig account
export const createMultisigAccount = async (
  data: CreateMultisigAccountDto
): Promise<MultisigAccountResponseDto> => {
  return apiServerWithAuth.postData<MultisigAccountResponseDto>(
    `/multisig/accounts`,
    data
  );
};

// GET: Get a multisig account by accountId (bech32)
export const getMultisigAccount = async (
  accountId: string
): Promise<MultisigAccountResponseDto> => {
  return apiServerWithAuth.getData<MultisigAccountResponseDto>(
    `/multisig/accounts/${accountId}`
  );
};

// GET: List all multisig accounts for a company
export const listAccountsByCompany = async (
  companyId: number
): Promise<MultisigAccountResponseDto[]> => {
  return apiServerWithAuth.getData<MultisigAccountResponseDto[]>(
    `/multisig/companies/${companyId}/accounts`
  );
};

// GET: Get consumable notes for an account
export const getConsumableNotes = async (accountId: string) => {
  return apiServerWithAuth.getData<{ notes: any[] }>(
    `/multisig/accounts/${accountId}/notes`
  );
};

// GET: Get account balances for an account
export const getAccountBalances = async (accountId: string) => {
  return apiServerWithAuth.getData<{ balances: any[] }>(
    `/multisig/accounts/${accountId}/balances`
  );
};

// POST: Get balances for multiple accounts
export const getBatchAccountBalances = async (
  data: GetBatchAccountBalancesDto
): Promise<GetBatchAccountBalancesResponseDto> => {
  const response = await apiServerWithAuth.postData<{
    accounts: Array<{
      account_id: string;
      balances: any[];
    }>;
  }>(`/multisig/accounts/balances`, data);

  // Extract base QASH token address (without routing params after underscore)
  const baseQashAddress = QASH_TOKEN_ADDRESS.split('_')[0];

  // Add stats to each account and normalize amounts
  const accountsWithStats: AccountBalancesInfoDto[] = response.accounts.map(
    (account) => {
      // Normalize amounts in balances
      const normalizedBalances = account.balances.map((b) => {
        const faucetIdBase = b.faucet_id.split('_')[0];
        const isQashToken =
          faucetIdBase.toLowerCase() === baseQashAddress.toLowerCase() ||
          b.faucet_id.toLowerCase() === QASH_TOKEN_ADDRESS.toLowerCase();

        return {
          faucetId: b.faucet_id,
          amount: isQashToken
            ? b.amount / Math.pow(10, QASH_TOKEN_DECIMALS)
            : b.amount,
        };
      });

      return {
        accountId: account.account_id,
        balances: normalizedBalances,
        stats: calculateAccountStats(account.balances),
      };
    }
  );

  return {
    accounts: accountsWithStats,
  };
};

// GET: List members for a multisig account
export const getAccountMembers = async (accountId: string) => {
  return apiServerWithAuth.getData<{ members: any[] }>(
    `/multisig/accounts/${accountId}/members`
  );
};

// POST: Mint tokens to a multisig account
export const mintTokens = async (
  accountId: string,
  data: MintTokensDto
): Promise<{ transactionId: string }> => {
  return apiServerWithAuth.postData<{ transactionId: string }>(
    `/multisig/accounts/${accountId}/mint`,
    data
  );
};

// ==========================================================================
// Proposal API
// ==========================================================================

// POST: Create a consume notes proposal
export const createConsumeProposal = async (
  data: CreateConsumeProposalDto
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(
    `/multisig/proposals/consume`,
    data
  );
};

// POST: Create a send funds proposal
export const createSendProposal = async (
  data: CreateSendProposalDto
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(
    `/multisig/proposals/send`,
    data
  );
};

// POST: Create a batch send funds proposal with multiple recipients
export const createBatchSendProposal = async (
  data: CreateBatchSendProposalDto
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(
    `/multisig/proposals/send-batch`,
    data
  );
};

// POST: Create a proposal from bills (multi-signature bill payment)
export const createProposalFromBills = async (
  data: CreateProposalFromBillsDto
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(
    `/multisig/proposals/from-bills`,
    data
  );
};

// GET: Get a proposal by ID
export const getProposal = async (
  proposalId: number
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.getData<MultisigProposalResponseDto>(
    `/multisig/proposals/${proposalId}`
  );
};

// GET: List all proposals for an account
export const listProposals = async (
  accountId: string
): Promise<MultisigProposalResponseDto[]> => {
  return apiServerWithAuth.getData<MultisigProposalResponseDto[]>(
    `/multisig/accounts/${accountId}/proposals`
  );
};

// GET: List all proposals for a company (across all multisig accounts)
export const listProposalsByCompany = async (
  companyId: number
): Promise<MultisigProposalResponseDto[]> => {
  return apiServerWithAuth.getData<MultisigProposalResponseDto[]>(
    `/multisig/companies/${companyId}/proposals`
  );
};

// POST: Submit a signature for a proposal
export const submitSignature = async (
  proposalId: number,
  data: SubmitSignatureDto
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(
    `/multisig/proposals/${proposalId}/signatures`,
    data
  );
};

// POST: Submit a rejection for a proposal
export const submitRejection = async (
  proposalId: number,
  data: SubmitRejectionDto
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(
    `/multisig/proposals/${proposalId}/rejections`,
    data
  );
};

// POST: Execute a proposal
export const executeProposal = async (
  proposalId: number
): Promise<ExecuteTransactionResponseDto> => {
  return apiServerWithAuth.postData<ExecuteTransactionResponseDto>(
    `/multisig/proposals/${proposalId}/execute`
  );
};

// POST: Cancel a proposal (deletes signatures, unlinks bills)
export const cancelProposal = async (
  proposalUuid: string
): Promise<MultisigProposalResponseDto> => {
  return apiServerWithAuth.postData<MultisigProposalResponseDto>(
    `/multisig/proposals/${proposalUuid}/cancel`
  );
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

  return useMutation<
    MultisigAccountResponseDto,
    Error,
    CreateMultisigAccountDto
  >({
    mutationFn: (data) => createMultisigAccount(data),
    onSuccess: (data) => {
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
export function useGetMultisigAccount(
  accountId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery<MultisigAccountResponseDto>({
    queryKey: ["multisig", "accounts", accountId],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return getMultisigAccount(accountId);
    },
    enabled: !!accountId && (options?.enabled !== false),
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to list multisig accounts by company
 */
export function useListAccountsByCompany(
  companyId?: number,
  options?: { enabled?: boolean }
) {
  return useQuery<MultisigAccountResponseDto[]>({
    queryKey: ["multisig", "companies", companyId, "accounts"],
    queryFn: () => {
      if (!companyId) throw new Error("companyId is required");
      return listAccountsByCompany(companyId);
    },
    enabled: !!companyId && (options?.enabled !== false),
    staleTime: 30000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to get consumable notes
 */
export function useGetConsumableNotes(
  accountId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery<{ notes: any[] }>({
    queryKey: ["multisig", "accounts", accountId, "notes"],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return getConsumableNotes(accountId);
    },
    enabled: !!accountId && (options?.enabled !== false),
    staleTime: 10000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to get account balances
 */
export function useGetAccountBalances(
  accountId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery<{ balances: any[] }>({
    queryKey: ["multisig", "accounts", accountId, "balances"],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return getAccountBalances(accountId);
    },
    enabled: !!accountId && (options?.enabled !== false),
    staleTime: 10000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to get balances for multiple accounts
 */
export function useGetBatchAccountBalances() {
  return useMutation<
    GetBatchAccountBalancesResponseDto,
    Error,
    GetBatchAccountBalancesDto
  >({
    mutationFn: (data) => getBatchAccountBalances(data),
  });
}

/**
 * React Query hook to list account members
 */
export function useGetAccountMembers(
  accountId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery<{ members: any[] }>({
    queryKey: ["multisig", "accounts", accountId, "members"],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return getAccountMembers(accountId);
    },
    enabled: !!accountId && (options?.enabled !== false),
    staleTime: 10000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to mint tokens to a multisig account
 */
export function useMintTokens() {
  const queryClient = useQueryClient();

  return useMutation<
    { transactionId: string },
    Error,
    { accountId: string; data: MintTokensDto }
  >({
    mutationFn: (params) => mintTokens(params.accountId, params.data),
    onSuccess: (data, params) => {
      // Invalidate account balances
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", params.accountId, "balances"],
      });
    },
  });
}

/**
 * React Query hook to create a consume proposal
 */
export function useCreateConsumeProposal() {
  const queryClient = useQueryClient();

  return useMutation<
    MultisigProposalResponseDto,
    Error,
    CreateConsumeProposalDto
  >({
    mutationFn: (data) => createConsumeProposal(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
    },
  });
}

/**
 * React Query hook to create a send proposal
 */
export function useCreateSendProposal() {
  const queryClient = useQueryClient();

  return useMutation<
    MultisigProposalResponseDto,
    Error,
    CreateSendProposalDto
  >({
    mutationFn: (data) => createSendProposal(data),
    onSuccess: (data) => {
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

  return useMutation<
    MultisigProposalResponseDto,
    Error,
    CreateBatchSendProposalDto
  >({
    mutationFn: (data) => createBatchSendProposal(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["multisig", "accounts", data.accountId, "proposals"],
      });
    },
  });
}

/**
 * React Query hook to create a proposal from bills (multi-signature bill payment)
 */
export function useCreateProposalFromBills() {
  const queryClient = useQueryClient();

  return useMutation<
    MultisigProposalResponseDto,
    Error,
    CreateProposalFromBillsDto
  >({
    mutationFn: (data) => createProposalFromBills(data),
    onSuccess: (data) => {
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
export function useGetProposal(
  proposalId?: number,
  options?: { enabled?: boolean }
) {
  return useQuery<MultisigProposalResponseDto>({
    queryKey: ["multisig", "proposals", proposalId],
    queryFn: () => {
      if (proposalId === undefined) throw new Error("proposalId is required");
      return getProposal(proposalId);
    },
    enabled: proposalId !== undefined && (options?.enabled !== false),
    staleTime: 10000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to list proposals for an account
 */
export function useListProposals(
  accountId?: string,
  options?: { enabled?: boolean }
) {
  return useQuery<MultisigProposalResponseDto[]>({
    queryKey: ["multisig", "accounts", accountId, "proposals"],
    queryFn: () => {
      if (!accountId) throw new Error("accountId is required");
      return listProposals(accountId);
    },
    enabled: !!accountId && (options?.enabled !== false),
    staleTime: 10000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to list proposals for a company (across all multisig accounts)
 */
export function useListProposalsByCompany(
  companyId?: number,
  options?: { enabled?: boolean }
) {
  return useQuery<MultisigProposalResponseDto[]>({
    queryKey: ["multisig", "companies", companyId, "proposals"],
    queryFn: () => {
      if (!companyId) throw new Error("companyId is required");
      return listProposalsByCompany(companyId);
    },
    enabled: !!companyId && (options?.enabled !== false),
    staleTime: 10000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

/**
 * React Query hook to submit a signature for a proposal
 */
export function useSubmitSignature() {
  const queryClient = useQueryClient();

  return useMutation<
    MultisigProposalResponseDto,
    Error,
    { proposalId: number; data: SubmitSignatureDto }
  >({
    mutationFn: ({ proposalId, data }) => submitSignature(proposalId, data),
    onSuccess: (data) => {
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

  return useMutation<
    MultisigProposalResponseDto,
    Error,
    { proposalId: number; data: SubmitRejectionDto }
  >({
    mutationFn: ({ proposalId, data }) => submitRejection(proposalId, data),
    onSuccess: (data) => {
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
 * React Query hook to execute a proposal
 */
export function useExecuteProposal() {
  const queryClient = useQueryClient();

  return useMutation<ExecuteTransactionResponseDto, Error, { proposalId: number }>(
    {
      mutationFn: ({ proposalId }) => executeProposal(proposalId),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["multisig", "proposals"] });
        queryClient.invalidateQueries({ queryKey: ["multisig", "accounts"] });
        queryClient.invalidateQueries({ queryKey: ["bills"] });
      },
    }
  );
}

/**
 * React Query hook to cancel a proposal
 */
export function useCancelProposal() {
  const queryClient = useQueryClient();

  return useMutation<MultisigProposalResponseDto, Error, { proposalUuid: string }>(
    {
      mutationFn: ({ proposalUuid }) => cancelProposal(proposalUuid),
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["multisig", "proposals"] });
        queryClient.invalidateQueries({
          queryKey: ["multisig", "accounts", data.accountId, "proposals"],
        });
        queryClient.invalidateQueries({ queryKey: ["bills"] });
      },
    }
  );
}
