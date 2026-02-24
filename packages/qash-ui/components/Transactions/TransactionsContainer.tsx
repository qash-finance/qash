"use client";
import React, { useState, useEffect, useMemo } from "react";
import { BaseContainer } from "../Common/BaseContainer";
import { ProposalRow } from "./ProposalRow";
import { NoteRow } from "./NoteRow";
import { useGetMyCompany } from "@/services/api/company";
import {
  useListAccountsByCompany,
  useListProposalsByCompany,
  useSignProposal,
  useExecuteProposal,
  useCancelProposal,
  useGetConsumableNotes,
  useCreateConsumeProposal,
} from "@/services/api/multisig";
import { MultisigProposalStatusEnum, TeamMemberRoleEnum } from "@qash/types/enums";
import toast from "react-hot-toast";
import { useModal } from "@/contexts/ModalManagerProvider";
import { useMidenProvider } from "@/contexts/MidenProvider";
import { useParaSigner } from "@/hooks/web3/useParaSigner";
import { getFaucetMetadata } from "@/services/utils/miden/faucet";
import { supportedTokens } from "@/services/utils/supportedToken";
import { useRouter } from "next/navigation";
import { PageHeader } from "../Common/PageHeader";
import { useAuth } from "@/services/auth/context";
import { trackEvent } from "@/services/analytics/posthog";
import { PostHogEvent } from "@/types/posthog";

// Previously a fixed enum - we now allow any multisig account id
type SubTabType = "pending" | "history" | "receive";

const subTabs: { id: SubTabType; label: string }[] = [
  { id: "pending", label: "Pending Transactions" },
  { id: "history", label: "History" },
  { id: "receive", label: "Receive" },
];

export function TransactionsContainer() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("pending");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"sign" | "execute" | "cancel" | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const { commitment: signerCommitment } = useParaSigner();
  const { user } = useAuth();

  const isViewer = user?.teamMembership?.role === TeamMemberRoleEnum.VIEWER;

  const { openModal, closeModal } = useModal();
  const { client: midenClient } = useMidenProvider();
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts = [], isLoading: accountsLoading } = useListAccountsByCompany(myCompany?.id, {
    enabled: !!myCompany?.id,
  });

  // Initialize activeTab when accounts load
  useEffect(() => {
    if (multisigAccounts.length > 0 && !activeTab) {
      setActiveTab(multisigAccounts[0].accountId);
      setActiveSubTab("pending");
    }
  }, [multisigAccounts, activeTab]);

  const {
    data: allProposals = [],
    isLoading: proposalsLoading,
    refetch: refetchProposals,
  } = useListProposalsByCompany(myCompany?.id, {
    enabled: !!myCompany?.id,
  });

  const {
    data: consumableNotesData = { notes: [] },
    isLoading: notesLoading,
    refetch: refetchNotes,
  } = useGetConsumableNotes(activeTab || "", {
    enabled: !!activeTab,
  });

  const signProposalMutation = useSignProposal();
  const executeProposalMutation = useExecuteProposal();
  const cancelProposalMutation = useCancelProposal();
  const createConsumeProposalMutation = useCreateConsumeProposal();

  // Get current selected account
  const currentAccount = multisigAccounts.find(a => a.accountId === activeTab);

  // Calculate pending proposal count for each account
  const pendingCountByAccount = useMemo(() => {
    const counts = new Map<string, number>();
    multisigAccounts.forEach(account => {
      const count = allProposals.filter(
        p =>
          p.accountId === account.accountId &&
          (p.status === MultisigProposalStatusEnum.PENDING || p.status === MultisigProposalStatusEnum.READY),
      ).length;
      counts.set(account.accountId, count);
    });
    return counts;
  }, [allProposals, multisigAccounts]);

  // Filter proposals by active account and status
  const pendingProposals = useMemo(() => {
    return allProposals
      .filter(p => p.accountId === activeTab)
      .filter(p => p.status === MultisigProposalStatusEnum.PENDING || p.status === MultisigProposalStatusEnum.READY);
  }, [allProposals, activeTab]);

  const historyProposals = useMemo(() => {
    return allProposals
      .filter(p => p.accountId === activeTab)
      .filter(
        p =>
          p.status === MultisigProposalStatusEnum.EXECUTED ||
          p.status === MultisigProposalStatusEnum.FAILED ||
          p.status === MultisigProposalStatusEnum.CANCELLED,
      );
  }, [allProposals, activeTab]);

  // Handle signing a proposal via PSM MultisigClient
  const handleSign = async (proposalId: number) => {
    const proposal = allProposals.find(p => p.id === proposalId);
    if (!proposal) {
      toast.error("Proposal not found");
      return;
    }

    const account = multisigAccounts.find(a => a.accountId === proposal.accountId);
    if (!account) {
      toast.error("Multisig account not found");
      return;
    }

    try {
      setActionLoadingId(proposal.uuid);
      setActionType("sign");
      openModal("PROCESSING_TRANSACTION");

      await signProposalMutation.mutateAsync({
        proposal,
        accountPublicKeys: account.publicKeys,
      });

      closeModal("PROCESSING_TRANSACTION");
      toast.success("Signature submitted successfully");
      trackEvent(PostHogEvent.PROPOSAL_SIGNED, { proposalId: String(proposalId) });
      refetchProposals();
    } catch (error) {
      closeModal("PROCESSING_TRANSACTION");
      console.error("Failed to sign proposal:", error);
      toast.error("Failed to sign proposal");
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  };

  // Handle executing a proposal via PSM
  const handleExecute = async (proposalId: number) => {
    const proposal = allProposals.find(p => p.id === proposalId);
    if (!proposal) {
      toast.error("Proposal not found");
      return;
    }

    try {
      setActionLoadingId(proposal.uuid);
      setActionType("execute");
      openModal("PROCESSING_TRANSACTION");

      await executeProposalMutation.mutateAsync({ proposalId, proposal });

      closeModal("PROCESSING_TRANSACTION");
      toast.success("Transaction executed successfully");
      trackEvent(PostHogEvent.PROPOSAL_EXECUTED, { proposalId: String(proposalId) });
      refetchProposals();
    } catch (error) {
      closeModal("PROCESSING_TRANSACTION");
      console.error("Failed to execute proposal:", error);
      toast.error("Failed to execute transaction");
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  };

  // Handle cancelling a proposal
  const handleCancel = async (proposalUuid: string) => {
    try {
      setActionLoadingId(proposalUuid);
      setActionType("cancel");

      await cancelProposalMutation.mutateAsync({ proposalUuid });

      toast.success("Proposal cancelled");
      trackEvent(PostHogEvent.PROPOSAL_CANCELLED, { proposalId: proposalUuid });
      refetchProposals();
    } catch (error) {
      console.error("Failed to cancel proposal:", error);
      toast.error("Failed to cancel proposal");
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  };

  // Handle note selection
  const handleNoteSelection = (noteId: string) => {
    setSelectedNoteIds(prev => (prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]));
  };

  // Handle select all notes
  const handleSelectAllNotes = () => {
    if (selectedNoteIds.length === consumableNotesData.notes.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(consumableNotesData.notes.map(note => note.note_id));
    }
  };

  // Handle create consume proposal
  const handleCreateConsumeProposal = async () => {
    if (selectedNoteIds.length === 0) {
      toast.error("Please select at least one note");
      return;
    }

    if (activeTab === null) {
      toast.error("No active multisig account selected");
      return;
    }

    try {
      setIsCreatingProposal(true);
      openModal("PROCESSING_TRANSACTION");

      // Build tokens array from selected notes' faucet IDs with amounts
      const selectedNotes = consumableNotesData.notes.filter(n => selectedNoteIds.includes(n.note_id));
      const faucetToAmount = new Map<string, string>();
      selectedNotes.forEach(n => {
        (n.assets || []).forEach((a: any) => {
          if (a.faucet_id) {
            const currentAmount = faucetToAmount.get(a.faucet_id) || "0";
            const newAmount = (BigInt(currentAmount) + BigInt(a.amount || "0")).toString();
            faucetToAmount.set(a.faucet_id, newAmount);
          }
        });
      });

      const faucetIds = Array.from(faucetToAmount.keys());
      const tokenPromises = faucetIds.map(async faucetId => {
        try {
          const meta = await getFaucetMetadata(midenClient, faucetId);
          return {
            address: faucetId,
            symbol: meta.symbol,
            decimals: meta.decimals,
            name: meta.symbol,
            amount: faucetToAmount.get(faucetId) || "0",
          };
        } catch (err) {
          // Fallback: check supportedTokens by symbol match from note assets
          const noteAsset = selectedNotes.flatMap(n => n.assets || []).find((a: any) => a.faucet_id === faucetId);
          const knownToken = noteAsset?.symbol
            ? supportedTokens.find(t => t.symbol.toUpperCase() === noteAsset.symbol.toUpperCase())
            : undefined;
          return {
            address: faucetId,
            symbol: knownToken?.symbol || noteAsset?.symbol || faucetId,
            decimals: knownToken?.decimals ?? noteAsset?.decimals ?? 0,
            name: knownToken?.symbol || noteAsset?.symbol || faucetId,
            amount: faucetToAmount.get(faucetId) || "0",
          };
        }
      });
      const tokens = await Promise.all(tokenPromises);

      await createConsumeProposalMutation.mutateAsync({
        accountId: activeTab,
        noteIds: selectedNoteIds,
        description: `Consume ${selectedNoteIds.length} note${selectedNoteIds.length !== 1 ? "s" : ""}`,
        tokens,
      });

      closeModal("PROCESSING_TRANSACTION");
      toast.success("Consume proposal created successfully");
      setSelectedNoteIds([]);
      refetchProposals();
      setActiveSubTab("pending"); // Switch to pending tab to see new proposal
    } catch (error) {
      closeModal("PROCESSING_TRANSACTION");
      console.error("Failed to create consume proposal:", error);
      toast.error("Failed to create consume proposal");
    } finally {
      setIsCreatingProposal(false);
    }
  };

  // Handle claiming a single note (select + create proposal)
  const handleClaimNote = async (noteId: string) => {
    if (activeTab === null) {
      toast.error("No active multisig account selected");
      return;
    }

    try {
      setIsCreatingProposal(true);
      openModal("PROCESSING_TRANSACTION");

      // Build tokens array for this note with amounts
      const note = consumableNotesData.notes.find(n => n.note_id === noteId);
      const faucetToAmount = new Map<string, string>();
      (note?.assets || []).forEach((a: any) => {
        if (a.faucet_id) {
          const currentAmount = faucetToAmount.get(a.faucet_id) || "0";
          const newAmount = (BigInt(currentAmount) + BigInt(a.amount || "0")).toString();
          faucetToAmount.set(a.faucet_id, newAmount);
        }
      });
      const faucetIds = Array.from(faucetToAmount.keys());
      const tokenPromises = faucetIds.map(async faucetId => {
        try {
          const meta = await getFaucetMetadata(midenClient, faucetId);
          return {
            address: faucetId,
            symbol: meta.symbol,
            decimals: meta.decimals,
            name: meta.symbol,
            amount: faucetToAmount.get(faucetId) || "0",
          };
        } catch (err) {
          // Fallback: check note assets and supportedTokens
          const noteAsset = (note?.assets || []).find((a: any) => a.faucet_id === faucetId);
          const knownToken = noteAsset?.symbol
            ? supportedTokens.find(t => t.symbol.toUpperCase() === noteAsset.symbol.toUpperCase())
            : undefined;
          return {
            address: faucetId,
            symbol: knownToken?.symbol || noteAsset?.symbol || faucetId,
            decimals: knownToken?.decimals ?? noteAsset?.decimals ?? 0,
            name: knownToken?.symbol || noteAsset?.symbol || faucetId,
            amount: faucetToAmount.get(faucetId) || "0",
          };
        }
      });
      const tokens = await Promise.all(tokenPromises);

      await createConsumeProposalMutation.mutateAsync({
        accountId: activeTab,
        noteIds: [noteId],
        description: "Consume note",
        tokens,
      });

      closeModal("PROCESSING_TRANSACTION");
      toast.success("Consume proposal created successfully");
      setSelectedNoteIds([]);
      refetchProposals();
      setActiveSubTab("pending"); // Switch to pending tab to see new proposal
    } catch (error) {
      closeModal("PROCESSING_TRANSACTION");
      console.error("Failed to create consume proposal:", error);
      toast.error("Failed to create consume proposal");
    } finally {
      setIsCreatingProposal(false);
    }
  };

  // Render the appropriate sub-tab content based on activeSubTab
  const renderSubtab = () => {
    switch (activeSubTab) {
      case "receive":
        return (
          <>
            {notesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue" />
              </div>
            ) : consumableNotesData.notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                <img src="/misc/hexagon-magnifer-icon.svg" alt="No Proposals" className="w-25" />
                <p className="text-lg font-medium">No consumable notes</p>
                <p className="text-sm">No notes available to consume on this account</p>
              </div>
            ) : (
              <>
                {consumableNotesData.notes.map(note => {
                  const isNoteInProposal = allProposals.some(
                    proposal =>
                      proposal.proposalType === "CONSUME" &&
                      proposal.noteIds?.includes(note.note_id) &&
                      // Exclude cancelled, failed, and rejected proposals
                      proposal.status !== "CANCELLED" &&
                      proposal.status !== "FAILED" &&
                      proposal.status !== "REJECTED",
                  );

                  return (
                    <NoteRow
                      key={note.note_id}
                      note={note}
                      selected={selectedNoteIds.includes(note.note_id)}
                      onSelect={handleNoteSelection}
                      onClaimNote={handleClaimNote}
                      isLoading={isCreatingProposal}
                      isInProposal={isNoteInProposal}
                      isViewer={isViewer}
                    />
                  );
                })}
              </>
            )}
          </>
        );

      case "pending": {
        return (
          <>
            {proposalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue" />
              </div>
            ) : pendingProposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                <img src="/misc/hexagon-magnifer-icon.svg" alt="No Proposals" className="w-25" />
                <p className="text-lg font-medium">No pending transactions</p>
                <p className="text-sm">Create a proposal from the Bills page to get started</p>
              </div>
            ) : (
              pendingProposals.map(proposal => (
                <ProposalRow
                  key={proposal.uuid}
                  proposal={proposal}
                  onSign={handleSign}
                  onExecute={handleExecute}
                  onCancel={handleCancel}
                  isSignLoading={actionLoadingId === proposal.uuid && actionType === "sign"}
                  isExecuteLoading={actionLoadingId === proposal.uuid && actionType === "execute"}
                  isCancelLoading={actionLoadingId === proposal.uuid && actionType === "cancel"}
                  userPublicKey={signerCommitment ?? undefined}
                  isViewer={isViewer}
                  onProposalClick={() => router.push(`/transactions/detail?proposalId=${proposal.id}`)}
                />
              ))
            )}
          </>
        );
      }

      case "history": {
        return (
          <>
            {proposalsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue" />
              </div>
            ) : historyProposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
                <img src="/misc/hexagon-magnifer-icon.svg" alt="No Proposals" className="w-25" />
                <p className="text-lg font-medium">No transaction history</p>
                <p className="text-sm">Executed, failed, and cancelled proposals will appear here</p>
              </div>
            ) : (
              historyProposals.map(proposal => (
                <ProposalRow
                  key={proposal.uuid}
                  proposal={proposal}
                  onSign={handleSign}
                  onExecute={handleExecute}
                  onCancel={handleCancel}
                  isSignLoading={actionLoadingId === proposal.uuid && actionType === "sign"}
                  isExecuteLoading={actionLoadingId === proposal.uuid && actionType === "execute"}
                  isCancelLoading={actionLoadingId === proposal.uuid && actionType === "cancel"}
                  userPublicKey={signerCommitment ?? undefined}
                  isViewer={isViewer}
                  onProposalClick={() => router.push(`/transactions/detail?proposalId=${proposal.id}`)}
                />
              ))
            )}
          </>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col w-full gap-3 p-4 items-start h-full">
      <PageHeader icon="/sidebar/transactions.svg" label="Transactions" button={null} />

      {/* Main Tabs - Based on Multisig Accounts */}
      {accountsLoading ? (
        <div className="w-full flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue" />
        </div>
      ) : multisigAccounts.length === 0 ? (
        <div className="w-full flex items-center justify-center py-12 text-text-secondary">
          <p>No multisig accounts found</p>
        </div>
      ) : (
        <>
          <div className="w-full flex flex-row border-b border-primary-divider">
            {multisigAccounts.map(account => {
              const pendingCount = pendingCountByAccount.get(account.accountId) || 0;
              return (
                <button
                  key={account.accountId}
                  onClick={() => {
                    setActiveTab(account.accountId);
                    setActiveSubTab("pending");
                    setSelectedNoteIds([]);
                  }}
                  className={`flex items-center justify-center gap-2 px-6 py-3 cursor-pointer group transition-colors duration-300 border-b-[3px] ${
                    activeTab === account.accountId
                      ? "border-primary-blue text-text-strong-950"
                      : "border-transparent text-text-soft-400 hover:text-text-soft-500"
                  }`}
                >
                  <p className="font-medium text-base leading-6 transition-colors duration-300">{account.name}</p>
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-6 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <BaseContainer
            header={
              <div className="flex w-full justify-center items-start py-4 flex-col">
                <span className="text-2xl">{currentAccount?.name || "Account"}</span>
                <p className="text-xs font-medium text-text-secondary max-w-2xl">
                  Since you are a member in this account, below are the transactions that need to be confirmed by you
                </p>
              </div>
            }
            childrenClassName="!bg-background"
            containerClassName="w-full h-full !px-8 !pb-6 !bg-app-background"
          >
            {/* Sub Tabs */}
            <div className="px-6 flex border-b border-primary-divider relative">
              {subTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveSubTab(tab.id);
                    setSelectedNoteIds([]);
                  }}
                  className={`py-4 text-base px-6 font-medium cursor-pointer transition-colors border-b-[3px] ${
                    activeSubTab === tab.id
                      ? "border-primary-blue text-text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Transactions List */}
            <div className="p-4 flex flex-col w-full h-full overflow-y-auto">{renderSubtab()}</div>
          </BaseContainer>
        </>
      )}
    </div>
  );
}
