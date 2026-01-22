"use client";
import React from "react";
import { PrimaryButton } from "@/components/Common/PrimaryButton";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import { MultisigProposalResponseDto } from "@qash/types/dto/multisig";
import { MultisigProposalStatusEnum } from "@qash/types/enums";

interface ProposalRowProps {
  proposal: MultisigProposalResponseDto;
  onSign?: (proposalId: number) => void;
  onExecute?: (proposalId: number) => void;
  onCancel?: (proposalUuid: string) => void;
  isSignLoading?: boolean;
  isExecuteLoading?: boolean;
  isCancelLoading?: boolean;
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

export function ProposalRow({
  proposal,
  onSign,
  onExecute,
  onCancel,
  isSignLoading,
  isExecuteLoading,
  isCancelLoading,
}: ProposalRowProps) {
  console.log("🚀 ~ ProposalRow ~ proposal:", proposal);
  const status = proposal.status as MultisigProposalStatusEnum;
  const config = statusConfig[status] || statusConfig[MultisigProposalStatusEnum.PENDING];
  const isPending = status === MultisigProposalStatusEnum.PENDING;
  const isReady = status === MultisigProposalStatusEnum.READY;
  const isHistory =
    status === MultisigProposalStatusEnum.EXECUTED ||
    status === MultisigProposalStatusEnum.FAILED ||
    status === MultisigProposalStatusEnum.CANCELLED;

  // Calculate how many bills
  const billCount = proposal.bills?.length || 0;
  const totalAmount = proposal.amount
    ? `${proposal.amount}`
    : proposal.bills?.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0) || 0;

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border-b border-primary-divider last:border-b-0 hover:bg-app-background">
      {/* Icon & Type */}
      <div className="flex items-center gap-3 w-24 flex-shrink-0">
        <img src="/transaction/pay-icon.svg" alt="Pay" className="w-6" />
        <span className="text-sm font-medium text-text-primary whitespace-nowrap">
          {proposal.proposalType === "SEND" ? "Pay" : "Consume"}
        </span>
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{proposal.description}</p>
        {billCount > 0 && (
          <p className="text-xs text-text-secondary truncate">
            {billCount} bill{billCount !== 1 ? "s" : ""} linked
          </p>
        )}
      </div>

      {/* Bills/Amount Count */}
      <div className="flex-shrink-0 w-32">
        {billCount > 0 ? (
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
            <span className="text-sm font-semibold text-blue-600">
              {billCount} bill{billCount !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-purple-50 border border-purple-200">
            <span className="text-sm font-semibold text-purple-600">{totalAmount}</span>
          </div>
        )}
      </div>

      {/* Signature Progress */}
      <div className="flex-shrink-0 w-32 flex items-center justify-center">
        <div
          className={`inline-flex items-center justify-center px-4 py-1 rounded-full border ${config.borderColor} ${config.bgColor}`}
        >
          <span className={`text-sm font-semibold ${config.textColor}`}>
            {isHistory ? config.label : `${proposal.signaturesCount}/${proposal.threshold}`}
          </span>
        </div>
      </div>

      {/* DateTime */}
      <div className="flex-shrink-0 w-36 text-center">
        <p className="text-sm font-medium text-text-secondary whitespace-nowrap">{formatDate(proposal.createdAt)}</p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center justify-center gap-2 w-52">
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
              text="Sign"
              buttonClassName="px-6"
              onClick={() => onSign?.(proposal.id)}
              loading={isSignLoading}
              disabled={isSignLoading || isCancelLoading}
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
        {isHistory && <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>}
      </div>
    </div>
  );
}
