"use client";
import React, { useState, useEffect, useMemo } from "react";
import { BaseContainer } from "../Common/BaseContainer";
import { ProposalRow } from "./ProposalRow";
import { useGetMyCompany } from "@/services/api/company";
import {
  useListAccountsByCompany,
  useListProposalsByCompany,
  useSubmitSignature,
  useExecuteProposal,
  useCancelProposal,
} from "@/services/api/multisig";
import { MultisigProposalStatusEnum } from "@qash/types/enums";
import toast from "react-hot-toast";
import { useModal } from "@/contexts/ModalManagerProvider";
import { bytesToHex, fromHexSig, hexToBytes } from "@/utils";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { useClient, useWallet } from "@getpara/react-sdk";

// Previously a fixed enum - we now allow any multisig account id
type SubTabType = "pending" | "history";

export function TransactionsContainer() {
  const [activeTab, setActiveTab] = useState<string>("payroll");
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("pending");
  const [underlineStyle, setUnderlineStyle] = useState({ left: "0px", width: "200px" });
  const [subTabUnderlineStyle, setSubTabUnderlineStyle] = useState({ left: "0px", width: "180px" });
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"sign" | "execute" | "cancel" | null>(null);
  const { data: wallet } = useWallet();
  const paraClient = useClient();

  const { openModal, closeModal } = useModal();
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts = [], isLoading: accountsLoading } = useListAccountsByCompany(myCompany?.id, {
    enabled: !!myCompany?.id,
  });
  const {
    data: allProposals = [],
    isLoading: proposalsLoading,
    refetch: refetchProposals,
  } = useListProposalsByCompany(myCompany?.id, { enabled: !!myCompany?.id });

  const submitSignatureMutation = useSubmitSignature();
  const executeProposalMutation = useExecuteProposal();
  const cancelProposalMutation = useCancelProposal();

  // Build tabs from accounts (fallback to some defaults if no accounts yet)
  const tabs =
    multisigAccounts.length > 0
      ? multisigAccounts.map(a => ({ id: a.accountId, label: a.name }))
      : [
          { id: "payroll", label: "Payroll Account" },
          { id: "earning", label: "Earning Account" },
          { id: "accounting", label: "Accounting Account" },
          { id: "marketing", label: "Marketing Account" },
        ];

  // If accounts load and no activeTab matches, set first account as active
  useEffect(() => {
    if (multisigAccounts.length > 0) {
      setActiveTab(prev => {
        const exists = multisigAccounts.some(a => a.accountId === prev);
        return exists ? prev : multisigAccounts[0].accountId;
      });
      setUnderlineStyle({ left: "0px", width: "200px" });
    }
  }, [multisigAccounts]);

  // Keep underline in sync when activeTab changes (use index of tabs)
  // useEffect(() => {
  //   const idx = tabs.findIndex(t => t.id === activeTab);
  //   if (idx >= 0) {
  //     setUnderlineStyle({ left: `${idx * 200}px`, width: "200px" });
  //   }
  // }, [activeTab, tabs]);

  const currentAccount = multisigAccounts.find(a => a.accountId === activeTab);

  // Filter proposals by account and status
  const filteredProposals = useMemo(() => {
    const accountProposals = allProposals.filter(p => p.accountId === activeTab);

    if (activeSubTab === "pending") {
      return accountProposals.filter(
        p => p.status === MultisigProposalStatusEnum.PENDING || p.status === MultisigProposalStatusEnum.READY,
      );
    } else {
      return accountProposals.filter(
        p =>
          p.status === MultisigProposalStatusEnum.EXECUTED ||
          p.status === MultisigProposalStatusEnum.FAILED ||
          p.status === MultisigProposalStatusEnum.CANCELLED,
      );
    }
  }, [allProposals, activeTab, activeSubTab]);

  // Handle signing a proposal
  const handleSign = async (proposalId: number) => {
    const proposal = allProposals.find(p => p.id === proposalId);
    if (!proposal) {
      toast.error("Proposal not found");
      return;
    }

    if (!wallet?.publicKey || !paraClient) {
      throw new Error("Wallet not connected");
    }

    try {
      setActionLoadingId(proposal.uuid);
      setActionType("sign");

      // Open signing modal - the actual signing will be done by Para wallet
      openModal("PROCESSING_TRANSACTION");

      // The message to sign is the keccak256 hash of the transaction summary commitment
      // This matches what miden-para does and what the Miden VM expects for ECDSA K256 Keccak verification
      const summaryCommitment = proposal.summaryCommitment;
      if (!summaryCommitment) {
        throw new Error("Proposal missing summary commitment for signing");
      }

      // Remove 0x prefix if present, then convert to bytes and hash with keccak256
      const commitmentHex = summaryCommitment.replace(/^0x/, "");
      const commitmentBytes = hexToBytes(commitmentHex);
      const hashedMessage = keccak_256(commitmentBytes);

      // Convert keccak hash to base64 for Para SDK
      const messageBase64 = btoa(String.fromCharCode(...hashedMessage));

      // Sign with Para popup
      const signResult = await paraClient.signMessage({
        walletId: wallet.id,
        messageBase64,
      });

      // Check if signing was successful
      if (!("signature" in signResult) || !signResult.signature) {
        throw new Error("Signing failed or was rejected");
      }

      // Convert Para hex signature to Miden serialized format
      // This adds the ECDSA auth scheme byte prefix (1) and padding
      const serializedSig = fromHexSig(signResult.signature as string);

      // Convert to hex string for backend
      const signatureHex = bytesToHex(serializedSig);

      // Compute approver index by finding the user's public key in the account's publicKeys
      const account = multisigAccounts.find(a => a.accountId === proposal.accountId);
      if (!account) {
        closeModal("PROCESSING_TRANSACTION");
        toast.error("Multisig account not found");
        return;
      }

      const normalizedUserKey = wallet.publicKey.toLowerCase().replace(/^0x/, "");
      const approverIndex = account.publicKeys.findIndex(
        pk => pk.toLowerCase().replace(/^0x/, "") === normalizedUserKey,
      );

      if (approverIndex === -1) {
        closeModal("PROCESSING_TRANSACTION");
        toast.error("Your public key is not an approver on this multisig account");
        return;
      }

      await submitSignatureMutation.mutateAsync({
        proposalId,
        data: {
          approverIndex,
          approverPublicKey: wallet.publicKey,
          signatureHex,
        },
      });

      closeModal("PROCESSING_TRANSACTION");
      toast.success("Signature submitted successfully");
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

  // Handle executing a proposal
  const handleExecute = async (proposalId: number) => {
    const proposal = allProposals.find(p => p.id === proposalId);

    try {
      setActionLoadingId(proposal?.uuid || String(proposalId));
      setActionType("execute");
      openModal("PROCESSING_TRANSACTION");

      await executeProposalMutation.mutateAsync({ proposalId });

      closeModal("PROCESSING_TRANSACTION");
      toast.success("Transaction executed successfully");
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
      refetchProposals();
    } catch (error) {
      console.error("Failed to cancel proposal:", error);
      toast.error("Failed to cancel proposal");
    } finally {
      setActionLoadingId(null);
      setActionType(null);
    }
  };

  const subTabs: { id: SubTabType; label: string }[] = [
    { id: "pending", label: "Pending to approve" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="flex flex-col w-full gap-6 px-4 py-2 items-start h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-4">
        <img src="/sidebar/transactions.svg" alt="Transactions" className="w-6" />
        <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
      </div>

      {/* Main Tabs */}
      <div className="w-full flex flex-row border-b border-primary-divider relative">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className="flex items-center justify-center w-[200px] py-3 cursor-pointer group transition-colors duration-300"
            onClick={() => {
              setActiveTab(tab.id);
              setActiveSubTab("pending");
              // Calculate underline position based on tab index
              setUnderlineStyle({
                left: `${index * 200}px`,
                width: "200px",
              });
            }}
          >
            <p
              className={`font-medium text-base leading-6 transition-colors duration-300 ${
                activeTab === tab.id ? "text-text-strong-950" : "text-text-soft-400 group-hover:text-text-soft-500"
              }`}
            >
              {tab.label}
            </p>
          </div>
        ))}
        <div
          className="absolute bottom-0 h-[3px] bg-primary-blue transition-all duration-300"
          style={{
            width: underlineStyle.width,
            left: underlineStyle.left,
          }}
        />
      </div>

      <BaseContainer
        header={
          <div className="flex w-full justify-center items-start py-4 flex-col">
            <span className="text-2xl">{currentAccount ? currentAccount.name : "Payroll"}</span>
            <p className="text-xs font-medium text-text-secondary max-w-2xl">
              Since you are a member in this account, below are the transactions that need to be confirmed by you
            </p>
          </div>
        }
        childrenClassName="!bg-background"
        containerClassName="w-full h-full !px-8 !pb-6 !bg-app-background"
      >
        {/* Sub Tabs */}
        <div className="px-6 flex gap-8 border-b border-primary-divider relative">
          {subTabs.map((tab, index) => (
            <div
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                setSubTabUnderlineStyle({
                  left: `${index * 180}px`,
                  width: "180px",
                });
              }}
              className={` py-4 text-base w-[180px] font-medium cursor-pointer transition-colors ${
                activeSubTab === tab.id ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </div>
          ))}
          <div
            className="absolute bottom-0 h-[3px] bg-primary-blue transition-all duration-300"
            style={{
              width: subTabUnderlineStyle.width,
              left: subTabUnderlineStyle.left,
            }}
          />
        </div>

        {/* Transactions List */}
        <div className="p-4 flex flex-col w-full h-full overflow-y-auto">
          {proposalsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue" />
            </div>
          ) : filteredProposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
              <img src="/empty-state.svg" alt="No proposals" className="w-24 h-24 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {activeSubTab === "pending" ? "No pending proposals" : "No transaction history"}
              </p>
              <p className="text-sm">
                {activeSubTab === "pending"
                  ? "Create a proposal from the Bills page to get started"
                  : "Executed, failed, and cancelled proposals will appear here"}
              </p>
            </div>
          ) : (
            filteredProposals.map(proposal => (
              <ProposalRow
                key={proposal.uuid}
                proposal={proposal}
                onSign={handleSign}
                onExecute={handleExecute}
                onCancel={handleCancel}
                isSignLoading={actionLoadingId === proposal.uuid && actionType === "sign"}
                isExecuteLoading={actionLoadingId === proposal.uuid && actionType === "execute"}
                isCancelLoading={actionLoadingId === proposal.uuid && actionType === "cancel"}
              />
            ))
          )}
        </div>
      </BaseContainer>
    </div>
  );
}
