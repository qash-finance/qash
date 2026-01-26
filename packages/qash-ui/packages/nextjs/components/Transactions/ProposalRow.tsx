"use client";
import React from "react";
import { formatUnits } from "viem";
import { PrimaryButton } from "@/components/Common/PrimaryButton";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import { MultisigProposalResponseDto } from "@qash/types/dto/multisig";
import { MultisigProposalStatusEnum } from "@qash/types/enums";
import { useGetConsumableNotes } from "@/services/api/multisig";
import { QASH_TOKEN_ADDRESS } from "@/services/utils/constant";
import { formatAddress } from "@/services/utils/miden/address";

interface ProposalRowProps {
  proposal: MultisigProposalResponseDto;
  onSign?: (proposalId: number) => void;
  onExecute?: (proposalId: number) => void;
  onCancel?: (proposalUuid: string) => void;
  isSignLoading?: boolean;
  isExecuteLoading?: boolean;
  isCancelLoading?: boolean;
  userPublicKey?: string;
}

const statusConfig: Record<string, { label: string; bgColor: string; borderColor: string; textColor: string }> = {
  [MultisigProposalStatusEnum.PENDING]: {
    label: "Pending",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-400",
    textColor: "text-yellow-700",
  },
  [MultisigProposalStatusEnum.READY]: {
    label: "Ready to Execute",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-400",
    textColor: "text-blue-700",
  },
  [MultisigProposalStatusEnum.EXECUTED]: {
    label: "Executed",
    bgColor: "bg-green-50",
    borderColor: "border-green-400",
    textColor: "text-green-700",
  },
  [MultisigProposalStatusEnum.FAILED]: {
    label: "Failed",
    bgColor: "bg-red-50",
    borderColor: "border-red-400",
    textColor: "text-red-700",
  },
  [MultisigProposalStatusEnum.CANCELLED]: {
    label: "Cancelled",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-400",
    textColor: "text-gray-700",
  },
};

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format amount with 8 decimals
function formatAmount(amount: number | string): string {
  try {
    const bigIntAmount = BigInt(Math.round(Number(amount)));
    return formatUnits(bigIntAmount, 8);
  } catch {
    return "0";
  }
}

export function ProposalRow({
  proposal,
  onSign,
  onExecute,
  onCancel,
  isSignLoading,
  isExecuteLoading,
  isCancelLoading,
  userPublicKey,
}: ProposalRowProps) {
  const status = proposal.status as MultisigProposalStatusEnum;
  const config = statusConfig[status] || statusConfig[MultisigProposalStatusEnum.PENDING];
  const isPending = status === MultisigProposalStatusEnum.PENDING;
  const isReady = status === MultisigProposalStatusEnum.READY;
  const isHistory =
    status === MultisigProposalStatusEnum.EXECUTED ||
    status === MultisigProposalStatusEnum.FAILED ||
    status === MultisigProposalStatusEnum.CANCELLED;

  // Check if current user has already signed this proposal
  const hasUserSigned = userPublicKey
    ? proposal.signatures?.some(
        sig => sig.approverPublicKey.toLowerCase().replace(/^0x/, "") === userPublicKey.toLowerCase().replace(/^0x/, ""),
      )
    : false;

  // Calculate how many bills
  const billCount = proposal.bills?.length || 0;
  const totalAmount = proposal.amount
    ? `${proposal.amount}`
    : proposal.bills?.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0) || 0;

  // Fetch consumable notes if this is a CONSUME proposal
  const { data: consumableNotesData = { notes: [] } } = useGetConsumableNotes(proposal.accountId, {
    enabled: proposal.proposalType === "CONSUME",
  });

  // Find the first note that matches this proposal's noteIds
  const proposalNote =
    proposal.proposalType === "CONSUME" && proposal.noteIds?.length
      ? consumableNotesData.notes.find(note => proposal.noteIds?.includes(note.note_id))
      : null;

  // Extract asset info from the note
  const firstAsset = proposalNote?.assets?.[0];
  const displayAmount = firstAsset ? formatAmount(firstAsset.amount) : "0";
  const faucetId = firstAsset?.faucet_id || "";

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 rounded-lg border-b border-primary-divider last:border-b-0 hover:bg-app-background">
      {/* Icon & Type */}
      <div className="flex items-center gap-3 justify-start">
        <img
          src={proposal.proposalType === "SEND" ? "/transaction/pay-icon.svg" : "/transaction/consume-icon.svg"}
          alt="Pay"
          className="w-6"
        />
        <span className="text-sm font-medium text-text-primary whitespace-nowrap">
          {proposal.proposalType === "SEND" ? "Pay" : "Recieve"}
        </span>
      </div>

      {/* Description */}
      <div className="flex items-center gap-2 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{proposal.description}</p>
      </div>

      {/* Bills/Amount Count */}
      <div className="flex items-center justify-center">
        {proposal.proposalType === "CONSUME" && proposalNote ? (
          // Show asset info for CONSUME proposals
          <div className="flex items-center justify-center">
            <img
              src={QASH_TOKEN_ADDRESS.startsWith(faucetId) ? "/token/qash.svg" : "/tokens/unknown-token.svg"}
              alt="Token"
              className="w-6 h-6 mr-2"
            />
            <span className="text-sm font-medium text-text-strong-950">
              {displayAmount} {QASH_TOKEN_ADDRESS.startsWith(faucetId) ? "QASH" : formatAddress(faucetId)}
            </span>
          </div>
        ) : billCount > 0 ? (
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
            <span className="text-sm font-semibold text-blue-600">
              {billCount} transactions{billCount !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-purple-50 border border-purple-200">
            <span className="text-sm font-semibold text-purple-600">{totalAmount}</span>
          </div>
        )}
      </div>

      {/* Signature Progress */}
      <div className="flex items-center justify-center">
        <div
          className={`inline-flex items-center justify-center px-4 py-1 rounded-full border ${config.borderColor} ${config.bgColor}`}
        >
          <span className={`text-sm font-semibold ${config.textColor}`}>
            {isHistory ? config.label : `${proposal.signaturesCount} out of ${proposal.threshold}`}
          </span>
        </div>
      </div>

      {/* DateTime */}
      <div className="flex items-center justify-center">
        <p className="text-sm font-medium text-text-secondary whitespace-nowrap">{formatDate(proposal.createdAt)}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {isPending && (
          <>
            <SecondaryButton
              text="Cancel"
              variant="dark"
              buttonClassName="px-4"
              onClick={() => onCancel?.(proposal.uuid)}
              loading={isCancelLoading}
              disabled={isCancelLoading || isSignLoading}
            />
            <PrimaryButton
              text={hasUserSigned ? "Signed" : "Sign"}
              buttonClassName="px-6"
              onClick={() => onSign?.(proposal.id)}
              loading={isSignLoading}
              disabled={hasUserSigned || isSignLoading || isCancelLoading}
            />
          </>
        )}
        {isReady && (
          <>
            <SecondaryButton
              text="Cancel"
              variant="dark"
              buttonClassName="px-4"
              onClick={() => onCancel?.(proposal.uuid)}
              loading={isCancelLoading}
              disabled={isCancelLoading || isExecuteLoading}
            />
            <PrimaryButton
              text="Execute"
              buttonClassName="px-4"
              onClick={() => onExecute?.(proposal.id)}
              loading={isExecuteLoading}
              disabled={isExecuteLoading || isCancelLoading}
            />
          </>
        )}
        {isHistory && (
          <span className={`text-sm font-medium ${config.textColor} whitespace-nowrap`}>{config.label}</span>
        )}
      </div>
    </div>
  );
}
