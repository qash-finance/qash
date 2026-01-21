"use client";
import React, { useState, useEffect } from "react";
import { BaseContainer } from "../Common/BaseContainer";
import { TransactionRow } from "./TransactionRow";
import { useGetMyCompany } from "@/services/api/company";
import { useListAccountsByCompany } from "@/services/api/multisig";

interface PayrollTransaction {
  id: string;
  type: "Pay";
  description: string;
  transactionCount: number;
  tokens: string[];
  status: "pending" | "completed";
  completionCount?: number;
  totalConfirmations?: number;
  dateTime: string;
}

const mockTransactions: PayrollTransaction[] = [
  {
    id: "1",
    type: "Pay",
    description: "Monthly payroll for December 2025",
    transactionCount: 50,
    tokens: ["token1", "token2", "token3"],
    status: "pending",
    completionCount: 1,
    totalConfirmations: 2,
    dateTime: "2025-12-05 08:00 AM",
  },
  {
    id: "2",
    type: "Pay",
    description: "Monthly payroll for November 2025",
    transactionCount: 50,
    tokens: ["token1", "token2", "token3"],
    status: "completed",
    dateTime: "2025-12-05 08:00 AM",
  },
];

// Previously a fixed enum - we now allow any multisig account id
type SubTabType = "pending" | "history";

export function TransactionsContainer() {
  const [activeTab, setActiveTab] = useState<string>("payroll");
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>("pending");
  const [underlineStyle, setUnderlineStyle] = useState({ left: "0px", width: "200px" });
  const [subTabUnderlineStyle, setSubTabUnderlineStyle] = useState({ left: "0px", width: "180px" });

  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts = [], isLoading: accountsLoading } = useListAccountsByCompany(myCompany?.id, {
    enabled: !!myCompany?.id,
  });

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
          {/* For now we show mocked transactions; in the future this will fetch transactions for `currentAccount` */}
          {mockTransactions.map(transaction => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onApprove={id => {
                // Handle approve logic
                console.log("Approve transaction:", id);
              }}
              onDeny={id => {
                // Handle deny logic
                console.log("Deny transaction:", id);
              }}
            />
          ))}
        </div>
      </BaseContainer>
    </div>
  );
}
