"use client";
import { useTitle } from "@/contexts/TitleProvider";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { SecondaryButton } from "../Common/SecondaryButton";
import { useInvoice } from "@/hooks/server/useInvoice";
import { CategoryBadge } from "../ContactBook/ContactBookContainer";
import { useGetAllEmployeeGroups } from "@/services/api/employee";
import { CategoryShapeEnum, InvoiceTypeEnum } from "@qash/types/enums";
import { useModal } from "@/contexts/ModalManagerProvider";
import { ChooseAccountModalProps, InvoiceModalProps } from "@/types/modal";
import { PrimaryButton } from "../Common/PrimaryButton";
import toast from "react-hot-toast";
import {
  useCreateProposalFromBills,
  useListAccountsByCompany,
} from "@/services/api/multisig";
import { BatchPaymentItem } from "@qash/types/dto/multisig";
import { useGetMyCompany } from "@/services/api/company";

const InvoiceItem = ({
  invoiceId,
  name,
  amount,
  amountUsd,
  group,
  onViewClick,
  token,
}: {
  invoiceId: string;
  name?: string;
  amount?: string;
  amountUsd?: string;
  group: { shape?: CategoryShapeEnum; color?: string; groupName?: string };
  onViewClick?: () => void;
  token: string;
}) => {
  const { shape, color, groupName } = group || {};
  return (
    <div className="grid grid-cols-[120px_120px_120px_1fr_120px] gap-10 items-center w-full border-b border-primary-divider px-4 py-3 bg-background rounded-xl">
      {/* Invoice ID Column */}
      <span className="text-sm font-medium text-text-primary">{invoiceId}</span>

      {/* Name Column */}
      <span className="text-sm font-medium text-text-primary">{name}</span>

      {/* Employee Badge Column */}
      <div className="flex justify-center items-center">
        <CategoryBadge
          shape={(shape as CategoryShapeEnum) || CategoryShapeEnum.CIRCLE}
          color={color || "#35ADE9"}
          name={groupName || "-"}
        />
      </div>
      {/* Amount Column */}
      <div className="flex items-end flex-col gap-2">
        <div className="flex flex-row gap-1 items-center">
          <img src={`/token/${token.toLowerCase()}.svg`} alt={token} className="w-5" />
          <span className=" font-medium text-text-primary leading-none">{amount}</span>
        </div>
        {/* <span className="text-sm text-text-secondary leading-none">{amountUsd}</span> */}
      </div>

      {/* View Button Column */}
      <button
        onClick={onViewClick}
        className="w-full px-4 py-2 bg-gray-100 rounded-lg text-sm font-semibold text-text-primary hover:bg-gray-200 transition-colors"
      >
        View
      </button>
    </div>
  );
};

const TokenItem = ({ token, amount, amountUsd }: { token: string; amount: string; amountUsd?: string }) => {
  return (
    <div className="flex justify-start items-center gap-2">
      <img src={`/token/${token.toLowerCase()}.svg`} alt={token} className="w-10" />

      <div className="flex items-start flex-col gap-0.5">
        <div className="text-[18px] leading-none">{amount}</div>
        {amountUsd && <div className="text-[16px] text-text-secondary leading-none">{amountUsd}</div>}
      </div>
    </div>
  );
};

const BillReviewContainer = () => {
  const router = useRouter();
  const { setTitle, setShowBackArrow, setOnBackClick } = useTitle();
  const { data: groups } = useGetAllEmployeeGroups();
  const { openModal, closeModal } = useModal();
  const { data: company } = useGetMyCompany();
  const createProposalMutation = useCreateProposalFromBills();
  const { data: multisigAccounts } = useListAccountsByCompany(company?.id);

  useEffect(() => {
    const handleBack = () => {
      router.back();
    };

    setTitle(
      <div className="flex items-center gap-2">
        <span className="text-text-secondary">Bills /</span>
        <span className="text-text-primary">Review invoices</span>
      </div>,
    );
    setShowBackArrow(true);
    setOnBackClick(() => handleBack);

    return () => {
      // clean up when component unmounts
      setOnBackClick(undefined);
      setShowBackArrow(false);
    };
  }, [router]);

  const searchParams = useSearchParams();
  const { fetchInvoiceByUUID } = useInvoice();
  const [selectedInvoices, setSelectedInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const { register, watch, getValues } = useForm({
    defaultValues: {
      searchTerm: "",
      proposalDescription: "",
    },
  });

  const searchTerm = watch("searchTerm");
  const proposalDescription = watch("proposalDescription");

  const tokenTotals = React.useMemo(() => {
    const map = new Map<string, { total: number; totalUsd: number }>();
    selectedInvoices.forEach(inv => {
      const currency = (
        inv.paymentToken.name.toUpperCase() ||
        inv.invoice?.paymentToken?.name?.toUpperCase() ||
        "USDT"
      ).toUpperCase();
      const total = Number(inv.total) || 0;
      const totalUsd = Number(inv.totalUsd) || 0;
      const prev = map.get(currency) || { total: 0, totalUsd: 0 };
      prev.total += total;
      prev.totalUsd += totalUsd;
      map.set(currency, prev);
    });
    return Array.from(map.entries()).map(([currency, v]) => ({ currency, total: v.total, totalUsd: v.totalUsd }));
  }, [selectedInvoices]);

  const totalUsdSum = React.useMemo(() => tokenTotals.reduce((s, t) => s + (t.totalUsd || 0), 0), [tokenTotals]);

  const filteredInvoices = React.useMemo(() => {
    if (!searchTerm) return selectedInvoices;
    return selectedInvoices.filter(inv => inv.fromDetails?.name?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [selectedInvoices, searchTerm]);

  useEffect(() => {
    const uuids = searchParams?.getAll ? searchParams.getAll("invoiceUUID") : [];
    if (!uuids || uuids.length === 0) return;

    let mounted = true;
    setLoadingInvoices(true);
    Promise.all(uuids.map(u => fetchInvoiceByUUID(u).catch(err => null)))
      .then(results => {
        if (!mounted) return;
        setSelectedInvoices(results.filter(Boolean) as any[]);
      })
      .catch(err => console.error("Failed to fetch invoices", err))
      .finally(() => setLoadingInvoices(false));

    return () => {
      mounted = false;
    };
  }, [searchParams, fetchInvoiceByUUID]);

  // Handle opening account selection modal
  const handlePayInvoice = () => {
    if (!company?.id) {
      return toast.error("Company not found");
    }

    if (!multisigAccounts || multisigAccounts.length === 0) {
      return toast.error("No multisig accounts found. Please create one first.");
    }

    openModal<ChooseAccountModalProps>("CHOOSE_ACCOUNT", {
      onConfirm: selectedAccount => {
        handleCreateProposal(selectedAccount.accountId);
      },
    });
  };

  // Handle creating a batch proposal from selected invoices
  const handleCreateProposal = async (accountId: string) => {
    if (selectedInvoices.length === 0) {
      return toast.error("No invoices selected for payment");
    }

    const description = getValues("proposalDescription").trim();

    if (description.length === 0) {
      return toast.error("Proposal description cannot be empty");
    }

    if (description.length > 500) {
      return toast.error("Proposal description cannot exceed 500 characters");
    }

    try {
      openModal("PROCESSING_TRANSACTION");

      // Collect tokens from selected invoices with accumulated amounts
      const tokenAddressToAmount = new Map<string, string>();
      selectedInvoices.forEach(inv => {
        const faucetId = (inv.paymentToken as any)?.address;
        const amount = Math.floor(Number(inv.total) * Math.pow(10, (inv.paymentToken as any)?.decimals ?? 6));

        // Accumulate amounts by token address
        if (faucetId) {
          const currentAmount = tokenAddressToAmount.get(faucetId) || "0";
          tokenAddressToAmount.set(faucetId, (BigInt(currentAmount) + BigInt(amount)).toString());
        }
      });

      // Build tokens array from accumulated totals
      const tokens = Array.from(tokenAddressToAmount.entries()).map(([address, amount]) => {
        const paymentToken = selectedInvoices.find(inv => (inv.paymentToken as any)?.address === address)
          ?.paymentToken as any;
        return {
          address,
          symbol: paymentToken?.symbol || address,
          decimals: paymentToken?.decimals ?? 6,
          name: paymentToken?.name || paymentToken?.symbol || address,
          amount,
        };
      });

      // Build per-invoice payments for PSM P2ID note construction
      const payments: BatchPaymentItem[] = selectedInvoices.map(inv => ({
        recipientId: inv.paymentWalletAddress,
        faucetId: (inv.paymentToken as any)?.address,
        amount: Math.floor(Number(inv.total) * Math.pow(10, (inv.paymentToken as any)?.decimals ?? 6)),
      }));

      await createProposalMutation.mutateAsync({
        accountId,
        billUUIDs: selectedInvoices.map(inv => inv.bill.uuid),
        description: description,
        tokens,
        payments,
      });

      closeModal("PROCESSING_TRANSACTION");
      toast.success(`Proposal created for ${selectedInvoices.length} invoice(s). Waiting for signatures.`);
      router.push("/transactions");
    } catch (error: any) {
      console.error("Failed to create proposal:", error);
      toast.error(error?.message || "Failed to create payment proposal");
    } finally {
      closeModal("PROCESSING_TRANSACTION");
    }
  };

  return (
    <div className="flex flex-col w-full h-full justify-start items-start p-7 gap-5">
      <div className="flex flex-row gap-3">
        <img src="/misc/flag-icon.svg" alt="Bill Placeholder" className="w-6" />
        <span className="font-bold text-2xl">Review invoices</span>
      </div>

      <div className="flex flex-row w-full h-full">
        {/* Left Side - Bill Details */}
        <div className="flex-1 border-r-0 border border-primary-divider rounded-l-2xl p-5 bg-app-background flex flex-col gap-5 h-full overflow-auto">
          <div className=" flex flex-row justify-between w-full items-center">
            <span className="font-semibold text-lg">Invoice list</span>
            <span className="text-lg text-text-secondary">
              Number of invoices
              <span className="text-primary-blue"> {filteredInvoices.length || 0}</span>
            </span>
            <div className="bg-[#E7E7E7] border border-primary-divider flex flex-row gap-2 items-center pr-1 pl-3 py-1 rounded-lg w-[300px]">
              <div className="flex flex-row gap-2 flex-1">
                <input
                  type="text"
                  placeholder="Search by name"
                  className="font-medium text-sm text-text-secondary bg-transparent border-none outline-none w-full"
                  {...register("searchTerm")}
                />
              </div>
              <button
                type="button"
                className="flex flex-row gap-1.5 items-center rounded-lg w-6 h-6 justify-center cursor-pointer"
              >
                <img src="/wallet-analytics/finder.svg" alt="search" className="w-4 h-4" />
              </button>
            </div>
          </div>
          {loadingInvoices ? (
            <div className="w-full flex justify-center items-center py-10">Loading selected invoices...</div>
          ) : (
            filteredInvoices.length > 0 &&
            filteredInvoices.map(inv => {
              const groupData = groups?.find(grp => grp.id === inv.employee?.groupId);
              return (
                <InvoiceItem
                  key={inv.uuid || inv.invoiceNumber}
                  invoiceId={inv.invoiceNumber || inv.uuid}
                  name={inv.fromDetails?.name || (inv.fromDetails as any).companyName}
                  amount={`${inv.total || 0} ${inv.paymentToken.symbol.toUpperCase() || "USDT"}`}
                  token={inv.paymentToken.name.toLowerCase()}
                  amountUsd={inv.totalUsd ? `$${inv.totalUsd}` : ""}
                  group={{
                    shape: groupData?.shape || CategoryShapeEnum.CIRCLE,
                    color: groupData?.color || "#35ADE9",
                    groupName: groupData?.name || "Client",
                  }}
                  onViewClick={() => {
                    openModal<InvoiceModalProps>("INVOICE_MODAL", {
                      invoice: {
                        amountDue: inv.total,
                        paymentToken: {
                          name: inv.paymentToken.name.toUpperCase(),
                        },
                        billTo: {
                          address: [
                            inv.toDetails?.address1,
                            inv.toDetails?.address2,
                            inv.toDetails?.city,
                            inv.toDetails?.country,
                          ]
                            .filter(Boolean)
                            .join(", "),
                          email: inv.toDetails?.email,
                          name: inv.toCompany?.companyName,
                          company: [inv.toCompany?.companyName, inv.toCompany?.companyType].filter(Boolean).join(" "),
                        },
                        currency: inv.currency,
                        date: inv.issueDate,
                        dueDate: inv.dueDate,
                        from: {
                          name: inv.employee?.name,
                          address: inv.employee?.address,
                          email: inv.employee?.email,
                          company: [inv.toCompany?.companyName, inv.toCompany?.companyType].filter(Boolean).join(" "),
                        },
                        invoiceNumber: inv.invoiceNumber,
                        items: inv.items.map((item: any) => ({
                          name: item.description,
                          rate: item.unitPrice,
                          qty: item.quantity,
                          amount: item.total,
                        })),
                        subtotal: inv.subtotal,
                        tax: 0,
                        total: inv.total,
                        walletAddress: inv.paymentWalletAddress,
                        network: "Miden",
                      },
                    });
                  }}
                />
              );
            })
          )}
          {/* Bill details content goes here */}
        </div>

        {/* Right Side - Review Summary - Edit the code here */}
        <div className="w-150 border-l-0 border border-primary-divider rounded-r-2xl bg-[#E7E7E7] h-full flex flex-col gap-4">
          <div className="flex flex-col h-full justify-between px-7 py-4">
            <div className=" flex flex-col gap-2 justify-between">
              <span className="font-bold text-3xl">Payment Overview</span>
              <span className="text-text-secondary ">Make sure the details are correct before proceeding.</span>
              <textarea
                {...register("proposalDescription")}
                placeholder={`Payment for ${selectedInvoices.length} invoice(s)`}
                aria-label="Proposal description"
                maxLength={500}
                className="w-full min-h-[96px] p-3 rounded-lg border border-primary-divider bg-white text-sm text-text-primary resize-none focus:outline-none"
              />
              {proposalDescription && proposalDescription.length > 0 && (
                <div className="text-xs text-text-secondary mt-1">{proposalDescription.length}/500</div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-semibold text-lg">Total by token</span>
              {tokenTotals.length === 0 ? (
                <div className="text-sm text-text-secondary">No invoices selected</div>
              ) : (
                tokenTotals.map(t => (
                  <TokenItem
                    key={t.currency}
                    token={t.currency}
                    amount={`${t.total} ${t.currency}`}
                    amountUsd={t.totalUsd ? `$${t.totalUsd}` : ""}
                  />
                ))
              )}
            </div>
          </div>

          <div className="flex w-full px-7 py-4 border-t-1 border-[#DBDCDE] justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-text-secondary leading-none">Total amount</span>
              <span className="font-bold text-3xl leading-none">
                {totalUsdSum > 0
                  ? `$${totalUsdSum}`
                  : tokenTotals.length === 1
                    ? `${tokenTotals[0].total} ${tokenTotals[0].currency}`
                    : `${selectedInvoices.length} invoices`}
              </span>
            </div>
            <PrimaryButton
              text="Propose"
              containerClassName="w-40 !rounded-xl"
              buttonClassName="h-full"
              onClick={handlePayInvoice}
              disabled={selectedInvoices.length === 0 || createProposalMutation.isPending}
              loading={createProposalMutation.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillReviewContainer;
