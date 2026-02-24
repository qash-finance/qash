"use client";

import {
  useGetProposal,
  useCancelProposal,
  useSignProposal,
  useSubmitRejection,
  useGetMultisigAccount,
  useGetConsumableNotes,
} from "@/services/api/multisig";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Badge, BadgeStatus } from "../Common/Badge";
import { SecondaryButton } from "../Common/SecondaryButton";
import toast from "react-hot-toast";
import { useModal } from "@/contexts/ModalManagerProvider";
import { ApproveVote, ConfirmVote, FinalVoteApproved, FinalVoteRejected, RejectVote } from "./Vote";
import { useParaSigner } from "@/hooks/web3/useParaSigner";
import { useMidenProvider } from "@/contexts/MidenProvider";
import { getFaucetMetadata } from "@/services/utils/miden/faucet";
import { formatUnits } from "viem";
import { formatAddress } from "@/services/utils/miden/address";
import { usePSMProvider } from "@/contexts/PSMProvider";
import { CategoryBadge } from "../ContactBook/ContactBookContainer";
import { CategoryShapeEnum } from "@qash/types/enums";
import { getInvoiceByUUID } from "@/services/api/invoice";
import { InvoiceModalProps } from "@/types/modal";

const TransactionDetailContainer = () => {
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const searchParams = useSearchParams();
  const proposalId = parseInt(searchParams.get("proposalId") || "", 10);
  const { commitment: signerCommitment } = useParaSigner();
  const { client: midenClient } = useMidenProvider();
  const { accountCacheMap } = usePSMProvider();
  const { data: proposal, isLoading, refetch: refetchProposal } = useGetProposal(proposalId);
  const { data: multisigAccount } = useGetMultisigAccount(proposal?.accountId, { enabled: !!proposal?.accountId });

  // Mutation hooks for voting
  const signProposalMutation = useSignProposal();
  const { mutate: submitRejection, isPending: isRejectionPending } = useSubmitRejection();

  const {
    data: consumableNotesData = { notes: [] },
  } = useGetConsumableNotes(multisigAccount?.accountId || "", {
    enabled: !!multisigAccount?.accountId,
  });
  console.log("🚀 ~ TransactionDetailContainer ~ consumableNotesData:", consumableNotesData);

  // Action handlers
  const handleCancelProposal = async () => {
    if (!proposal) return;
    try {
      await useCancelProposal();
      toast.success("Proposal cancelled successfully");
      router.replace("/bill");
    } catch (err) {
      console.error("Failed to cancel proposal:", err);
      toast.error("Failed to cancel proposal");
    }
  };

  const handleApproveProposal = async () => {
    if (!proposal || !multisigAccount) return;

    if (!signerCommitment) {
      toast.error("Para signer not ready");
      return;
    }

    try {
      openModal("PROCESSING_TRANSACTION");

      await signProposalMutation.mutateAsync({
        proposal,
        accountPublicKeys: multisigAccount.publicKeys,
      });

      closeModal("PROCESSING_TRANSACTION");
      toast.success("Signature submitted successfully");
      refetchProposal();
    } catch (error) {
      closeModal("PROCESSING_TRANSACTION");
      console.error("Failed to approve proposal:", error);
      toast.error("Failed to approve proposal");
    }
  };

  const handleRejectProposal = () => {
    if (!proposal) return;

    submitRejection(
      {
        proposalId,
        data: {
          reason: "Reject Proposal",
        },
      },
      {
        onSuccess: () => {
          toast.success("Proposal rejected successfully");
          refetchProposal();
        },
        onError: err => {
          console.error("Failed to reject proposal:", err);
          toast.error("Failed to reject proposal");
        },
      },
    );
  };

  const handleViewInvoice = async (invoiceUuid: string) => {
    try {
      const invoice = await getInvoiceByUUID(invoiceUuid);
      if (!invoice) {
        toast.error("Invoice not found");
        return;
      }
      openModal<InvoiceModalProps>("INVOICE_MODAL", {
        invoice: {
          amountDue: invoice.total!,
          billTo: {
            address: [
              invoice.toDetails?.address1,
              invoice.toDetails?.address2,
              invoice.toDetails?.city,
              invoice.toDetails?.country,
            ]
              .filter(Boolean)
              .join(", "),
            email: invoice.toCompany?.email,
            name: invoice.toCompany?.companyName,
            company: [invoice.toCompany?.companyName, invoice.toCompany?.companyType].filter(Boolean).join(" "),
          },
          paymentToken: {
            name: invoice.paymentToken?.name?.toUpperCase() || "USDT",
          },
          currency: invoice.currency || "USD",
          date: invoice.issueDate!,
          dueDate: invoice.dueDate!,
          from: {
            name: invoice.fromDetails?.name!,
            address: invoice.fromDetails?.address!,
            email: invoice.fromDetails?.email!,
            company: `${invoice.fromCompany?.companyName || invoice.payroll?.company?.companyName}`,
          },
          invoiceNumber: invoice.invoiceNumber!,
          items: invoice.items?.map((item: any) => ({
            name: item.description,
            rate: item.unitPrice,
            qty: item.quantity,
            amount: item.total,
          })) || [],
          subtotal: parseFloat(invoice.subtotal?.toString() || "0"),
          tax: 0,
          total: parseFloat(invoice.total?.toString() || "0"),
          walletAddress: invoice.paymentWalletAddress!,
          network: "Miden",
        },
      });
    } catch {
      toast.error("Failed to load invoice");
    }
  };

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return "N/A";
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString?: string | Date) => {
    if (!dateString) return "N/A";
    const date = typeof dateString === "string" ? new Date(dateString) : dateString;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Map multisig status to badge display
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "EXECUTED":
        return { text: "PAID", status: BadgeStatus.SUCCESS };
      case "FAILED":
      case "CANCELLED":
      case "REJECTED":
        return { text: status, status: BadgeStatus.FAIL };
      case "READY":
        return { text: "READY TO EXECUTE", status: BadgeStatus.AWAITING };
      case "PENDING":
      default:
        return { text: "PENDING", status: BadgeStatus.AWAITING };
    }
  };

  // Approvers derived from proposal (populated by backend)
  const approvers = proposal?.approvers || [];
  const approvedMembers = approvers.filter((a: any) => a.signed);
  const pendingMembers = approvers.filter((a: any) => !a.signed);

  // Determine current user's voting status by checking signatures and rejections data
  // The backend enriches approver objects with 'signed' boolean and 'signature' object
  // We check if the current user's signer commitment matches an approver with signed=true

  const hasUserApproved =
    signerCommitment &&
    approvers.some((approver: any) => {
      const normalizedCommitment = signerCommitment.toLowerCase().replace(/^0x/, "");
      const normalizedApproverKey = (approver.publicKey || "").toLowerCase().replace(/^0x/, "");
      return normalizedApproverKey === normalizedCommitment && approver.signed === true;
    });

  const hasUserRejected =
    signerCommitment &&
    proposal?.rejections &&
    proposal.rejections.length > 0 &&
    approvers.some((approver: any) => {
      const normalizedCommitment = signerCommitment.toLowerCase().replace(/^0x/, "");
      const normalizedApproverKey = (approver.publicKey || "").toLowerCase().replace(/^0x/, "");
      return (
        normalizedApproverKey === normalizedCommitment &&
        proposal.rejections?.some((rejection: any) => rejection.approverIndex === approver.id)
      );
    });

  // Resolve note token info using enriched data from consumable notes (already has symbol/decimals)
  const getNoteTokenInfo = (noteId: string): { symbol: string; amount: string; faucetId: string } | null => {
    const consumableNote = consumableNotesData.notes.find(
      (note: any) => note.note_id.toLowerCase() === noteId.toLowerCase(),
    );
    if (!consumableNote || !consumableNote.assets || consumableNote.assets.length === 0) return null;

    const asset = consumableNote.assets[0];
    const decimals = asset.decimals ?? 8;
    const symbol = asset.symbol || formatAddress(asset.faucet_bech32 || asset.faucet_id);
    try {
      const formatted = formatUnits(BigInt(asset.amount), decimals);
      return { symbol, amount: formatted, faucetId: asset.faucet_id };
    } catch {
      return { symbol, amount: String(asset.amount), faucetId: asset.faucet_id };
    }
  };

  // Helper function to render appropriate vote component based on proposal status and user state
  const renderVoteComponent = () => {
    if (!proposal) return null;

    const { status } = proposal;

    // PENDING status with user voting states
    if (status === "PENDING" && !hasUserApproved && !hasUserRejected) {
      console.log("Rendering: ConfirmVote");
      return (
        <ConfirmVote
          onApprove={handleApproveProposal}
          onDeny={handleRejectProposal}
          isLoading={signProposalMutation.isPending || isRejectionPending}
        />
      );
    }
    if (status === "PENDING" && hasUserApproved) {
      console.log("Rendering: ApproveVote");
      return <ApproveVote />;
    }
    if (status === "PENDING" && hasUserRejected) {
      console.log("Rendering: RejectVote");
      return <RejectVote />;
    }

    // READY status
    if (status === "READY") {
      console.log("Rendering: ApproveVote (READY status)");
      return <ApproveVote />;
    }

    // EXECUTED status
    if (status === "EXECUTED") {
      console.log("Rendering: FinalVoteApproved");
      return <FinalVoteApproved />;
    }

    // Final rejection states (FAILED, CANCELLED, REJECTED)
    if (status === "FAILED" || status === "CANCELLED" || status === "REJECTED") {
      console.log("Rendering: FinalVoteRejected");
      return <FinalVoteRejected />;
    }

    return null;
  };

  // Resolve token metadata from PSM cache, then SDK faucet lookup as fallback
  const token = proposal?.tokens?.[0];
  const sendFaucetId = token?.address || "";
  const [sendFaucetMeta, setSendFaucetMeta] = useState<{ symbol: string; decimals: number } | null>(null);

  // Look up enriched metadata from PSM cache (already has bech32, symbol, decimals)
  const accountKey = proposal?.accountId
    ? (proposal.accountId.toLowerCase().startsWith("0x") ? proposal.accountId.toLowerCase() : `0x${proposal.accountId}`.toLowerCase())
    : "";
  const accountCache = accountKey ? accountCacheMap.get(accountKey) : undefined;
  const enrichedMatch = accountCache?.enrichedBalances.find(
    eb => eb.faucetId.toLowerCase() === sendFaucetId.toLowerCase(),
  );

  useEffect(() => {
    if (!midenClient || !sendFaucetId || enrichedMatch) return;
    let cancelled = false;
    getFaucetMetadata(midenClient, sendFaucetId)
      .then(meta => { if (!cancelled) setSendFaucetMeta(meta); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [midenClient, sendFaucetId, enrichedMatch]);

  const sendTokenSymbol = enrichedMatch?.symbol || sendFaucetMeta?.symbol || token?.symbol || (proposal?.bills?.[0]?.paymentToken as any)?.name || "TOKEN";
  const sendTokenDecimals = enrichedMatch?.decimals ?? sendFaucetMeta?.decimals ?? token?.decimals ?? 0;
  const displayAmount = token?.amount
    ? (() => { try { return formatUnits(BigInt(token.amount), sendTokenDecimals); } catch { return proposal?.amount || "-"; } })()
    : proposal?.amount || "-";

  if (isLoading || !proposal) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="w-12 h-12 border-4 border-primary-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  const statusBadge = getStatusBadge(proposal.status);
  const pendingCount = pendingMembers.length;

  return (
    <div className="flex flex-col w-full h-full px-10 py-5 gap-6 bg-background">
      <div className="flex flex-row gap-5 items-center">
        <span className="text-xl leading-none font-bold text-text-primary">{proposal.description}</span>
      </div>

      <div className="w-full h-full flex flex-row gap-5">
        <div className="flex-1 flex-col w-full h-full gap-2 flex">
          {/* Proposal Details Cards */}
          <div className="flex flex-row gap-3 w-full">
            {/* First Card - Proposal Details */}
            <div className="flex-1 border border-primary-divider rounded-2xl p-5 flex flex-col gap-4">
              {/* Title Row */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-20">Title</p>
                <p className="text-sm text-text-primary  font-semibold">{proposal.description}</p>
              </div>

              {/* Type Row */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-20">Type</p>
                <div className="flex items-center gap-2">
                  <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                    {proposal.proposalType}
                  </span>
                </div>
              </div>

              {/* Created Date Row */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-20">Create date</p>
                <p className="text-sm text-text-primary  font-semibold">{formatDateTime(proposal.createdAt)}</p>
              </div>

              {/* Status Row */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-20">Status</p>
                <Badge text={statusBadge.text} status={statusBadge.status} />
              </div>
            </div>

            {/* Second Card - Account & Threshold */}
            <div className="flex-1 border border-primary-divider rounded-2xl p-5 flex flex-col gap-4">
              {/* Account Row */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-16">Account</p>
                <div className="flex gap-2 items-center flex-row">
                  <img
                    src={multisigAccount?.logo ? multisigAccount.logo : "/client-invoice/payroll-icon.svg"}
                    alt="Multisig Account"
                    className="w-5 h-5 rounded-lg"
                  />
                  <p className="text-sm text-text-primary leading-none font-semibold">{multisigAccount?.name}</p>
                </div>
              </div>

              {/* Member Count Row */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-16">Members</p>
                <p className="text-sm text-text-primary leading-none font-semibold">
                  {multisigAccount?.publicKeys?.length}
                </p>
              </div>

              {/* Threshold Row */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-16">Threshold</p>
                <p className="text-sm text-text-primary leading-none font-semibold">
                  {proposal.signaturesCount || 0}/{multisigAccount?.threshold || 0}
                </p>
              </div>

              {/* Approved Progress Bar */}
              <div className="flex gap-4 items-center">
                <p className="text-sm text-text-secondary font-medium w-16">Approved</p>
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1 h-1.5 bg-app-background rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{
                        width: `${((proposal.signaturesCount || 0) / (multisigAccount?.threshold || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-text-secondary font-semibold text-right w-12">
                    {proposal.signaturesCount || 0}/{multisigAccount?.threshold || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="border border-primary-divider rounded-2xl overflow-hidden flex flex-col h-fit">
            <div className="flex flex-row justify-between items-center px-4 py-3 border-b border-primary-divider">
              <h2 className="text-2xl font-bold text-text-primary">Transaction Details</h2>
              <div className="flex gap-8 items-center">
                {proposal.bills && proposal.bills.length > 0 && (
                  <>
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-text-secondary font-medium">Number of transactions</span>
                      <span className="text-sm text-text-primary font-semibold">{proposal.bills.length}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-text-secondary font-medium">Total amount</span>
                      <span className="text-sm text-text-primary font-semibold">
                        {displayAmount} {sendTokenSymbol.toUpperCase()}
                      </span>
                    </div>
                  </>
                )}
                {(!proposal.bills || proposal.bills.length === 0) && (
                  <>
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-text-secondary font-medium">Type</span>
                      <span className="text-sm text-text-primary font-semibold">{proposal.proposalType}</span>
                    </div>
                    {proposal.proposalType === "SEND" && (
                      <div className="flex gap-2 items-center">
                        <span className="text-sm text-text-secondary font-medium">Amount</span>
                        <span className="text-sm text-text-primary font-semibold">
                          {displayAmount} {sendTokenSymbol.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="overflow-y-auto flex-1">
              {/* Bills / Invoice rows */}
              {proposal.bills && proposal.bills.length > 0 ? (
                proposal.bills.map((bill: any, idx: number) => {
                  const tokenSymbol = bill.paymentToken?.symbol || bill.paymentToken?.name || sendTokenSymbol;
                  return (
                    <div
                      key={bill.uuid}
                      className="grid grid-cols-[1fr_1.5fr_1.5fr_2fr_1.5fr] gap-3 px-4 py-3 border-b border-primary-divider last:border-b-0 items-center"
                    >
                      <p className="text-sm text-text-primary font-medium">{bill.invoiceNumber || `TX${String(idx + 1).padStart(3, "0")}`}</p>
                      <p className="text-sm text-text-primary font-medium">{bill.recipientName || "—"}</p>
                      <div className="flex justify-center items-center">
                        {bill.group ? (
                          <CategoryBadge
                            shape={(bill.group.shape as CategoryShapeEnum) || CategoryShapeEnum.CIRCLE}
                            color={bill.group.color || "#35ADE9"}
                            name={bill.group.name || "Employee"}
                          />
                        ) : (
                          <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                            Employee
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <p className="text-sm text-text-primary font-semibold">
                          {bill.amount || "—"} {tokenSymbol.toUpperCase()}
                        </p>
                      </div>
                      <div className="flex justify-end">
                        {bill.invoiceUuid ? (
                          <SecondaryButton
                            text="View Invoice"
                            variant="light"
                            buttonClassName="px-4"
                            onClick={() => handleViewInvoice(bill.invoiceUuid)}
                          />
                        ) : (
                          <SecondaryButton text="View Details" variant="light" buttonClassName="px-4" onClick={() => {}} />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  {/* Fallback for SEND proposals without bills */}
                  {proposal.proposalType === "SEND" && (
                    <div className="grid grid-cols-[1fr_1.5fr_1.5fr_2fr_1.5fr] gap-3 px-4 py-3 border-b border-primary-divider last:border-b-0 items-center">
                      <p className="text-sm text-text-primary font-medium">TX001</p>
                      <p className="text-sm text-text-primary font-medium">{proposal.recipientId ? formatAddress(proposal.recipientId) : "—"}</p>
                      <div>
                        <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-medium">
                          Transfer
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <p className="text-sm text-text-primary font-semibold">
                          {displayAmount} {sendTokenSymbol.toUpperCase()}
                        </p>
                      </div>
                      <div className="flex justify-end" />
                    </div>
                  )}
                  {/* CONSUME proposals */}
                  {proposal.proposalType === "CONSUME" &&
                    proposal.noteIds &&
                    proposal.noteIds.map((noteId, idx) => {
                      const noteTokenInfo = getNoteTokenInfo(noteId);
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr_1.5fr_1.5fr_1fr] gap-3 px-4 py-3 border-b border-primary-divider last:border-b-0 items-center"
                        >
                          <p className="text-sm text-text-primary font-medium">NOTE{String(idx + 1).padStart(4, "0")}</p>
                          <p className="text-sm text-text-primary font-medium">{noteId.slice(0, 16)}...</p>
                          <div>
                            <span className="inline-block bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-sm font-medium">
                              Consume
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 text-right">
                            {noteTokenInfo ? (
                              <p className="text-sm text-text-primary font-semibold">
                                {noteTokenInfo.amount} {noteTokenInfo.symbol}
                              </p>
                            ) : (
                              <div className="flex flex-col items-end justify-end gap-1">
                                <div className="h-2 bg-neutral-300 rounded-full w-20 animate-pulse"></div>
                                <div className="h-2 bg-neutral-300 rounded-full w-10 animate-pulse"></div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </div>

          {/* Members */}
          <div className="border border-primary-divider rounded-2xl overflow-hidden flex flex-col h-fit">
            <div className="flex flex-row justify-between items-center px-4 py-3 border-b border-primary-divider">
              <h2 className="text-2xl font-bold text-text-primary">Approvers</h2>
              <div className="flex gap-2 items-center">
                <span className="text-sm text-text-secondary font-medium">Threshold</span>
                <span className="text-sm text-text-primary font-semibold">
                  {proposal.signaturesCount || 0}/{multisigAccount?.threshold || 0}
                </span>
              </div>
            </div>

            {/* Approvers Grid */}
            <div className="flex gap-5 p-5">
              {/* Pending Column */}
              <div className="flex flex-col gap-4 w-48">
                <div className="flex gap-3 items-center">
                  <span className="text-sm text-text-secondary font-medium">Pending</span>
                  <span className="text-sm text-primary-blue font-semibold">{pendingCount}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {pendingMembers.length > 0 ? (
                    pendingMembers.map((m: any, idx: number) => (
                      <p key={idx} className="text-sm text-text-primary font-semibold">
                        {m.firstName || "Approver"} {m.lastName || ""}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-text-secondary">All approvers have signed</p>
                  )}
                </div>
              </div>

              {/* Approved Column */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex gap-3 items-center">
                  <span className="text-sm text-text-secondary font-medium">Approved</span>
                  <span className="text-sm text-primary-blue font-semibold">{approvedMembers.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {approvedMembers.map((a: any, idx: number) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <p className="text-sm text-text-primary font-semibold">
                        {a.firstName || "Approver"} {a.lastName || ""}
                      </p>
                      <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                        Approved
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rejected Column */}
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-center">
                  <span className="text-sm text-text-secondary font-medium">Rejected</span>
                  <span className="text-sm text-primary-blue font-semibold">0</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="w-80 flex flex-col gap-3">
          <div className="border border-primary-divider rounded-2xl px-4 flex-1 flex flex-col justify-between py-2">
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold text-text-primary pb-4">Progress</h2>

              <div className="flex flex-col gap-3">
                {/* Build timeline from proposal creation, signatures, and execution */}
                {[
                  {
                    label: "Proposal created",
                    date: formatDateTime(proposal.createdAt),
                    icon: "/misc/blue-polygon.svg",
                  },
                  ...approvedMembers.map((a: any, idx: number) => ({
                    label: `${a.firstName || "Approver"} signed`,
                    date: formatDateTime(a.signature?.createdAt || a.signature?.createdAt),
                    icon: "/misc/blue-polygon.svg",
                  })),

                  proposal.status === "EXECUTED" &&
                    proposal.transactionId && {
                      label: "Proposal executed",
                      date: formatDateTime(proposal.updatedAt),
                      icon: "/misc/blue-polygon.svg",
                    },
                  (proposal.status === "FAILED" || proposal.status === "CANCELLED") && {
                    label: `Proposal ${proposal.status.toLowerCase()}`,
                    date: formatDateTime(proposal.updatedAt),
                    icon: "/misc/blue-polygon.svg",
                  },
                ]
                  .filter(Boolean)
                  .map((item: any, idx, arr) => (
                    <div className="flex gap-7 pb-6" key={idx}>
                      {/* Timeline Marker */}
                      <div className="flex flex-col items-center pt-1 relative">
                        <img
                          src={item.icon || "/misc/blue-polygon.svg"}
                          alt="Timeline Marker"
                          className="w-6 h-6 z-10"
                        />
                        {/* Vertical Line (not for first item) */}
                        {idx !== 0 && (
                          <div
                            className="absolute top-0 left-1/2 -translate-x-1/2"
                            style={{ height: 75, width: 4, background: "#066EFF", zIndex: 0, marginTop: -50 }}
                          />
                        )}
                      </div>
                      {/* Timeline Content */}
                      <div className="flex flex-col gap-1.5 w-40">
                        <p className="text-sm font-semibold text-text-primary leading-none">{item.label}</p>
                        <p className="text-sm font-medium text-text-secondary leading-none">{item.date}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            {/* Vote Status Section */}
            {renderVoteComponent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDetailContainer;
