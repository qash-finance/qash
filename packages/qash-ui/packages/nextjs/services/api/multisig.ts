import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiServerWithAuth } from "./index";
import type {
  CreateMultisigAccountDto,
  MultisigAccountResponseDto,
  CreateConsumeProposalDto,
  CreateSendProposalDto,
  CreateBatchSendProposalDto,
  CreateProposalFromBillsDto,
  MultisigProposalResponseDto,
  SubmitSignatureDto,
  ExecuteTransactionResponseDto,
} from "@qash/types/dto/multisig";

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

// GET: List members for a multisig account
export const getAccountMembers = async (accountId: string) => {
  return apiServerWithAuth.getData<{ members: any[] }>(
    `/multisig/accounts/${accountId}/members`
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
