"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/services/auth/context";
import { PrimaryButton } from "../Common/PrimaryButton";
import Card from "../Common/Card";
import AccountTab, { Account } from "./TeamSetting/AccountTab";
import MemberTab from "./TeamSetting/MemberTab";
import { useModal } from "@/contexts/ModalManagerProvider";
import { useGetMyCompany } from "@/services/api/company";
import { useListAccountsByCompany } from "@/services/api/multisig";
import CompanyAvatar from "../Common/CompanyAvatar";
import { useGetTeamStats } from "@/services/api/team-member";

const TeamSettings = () => {
  const { openModal } = useModal();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "member">("account");
  // Fetch the current company and list its multisig accounts
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts, isLoading: accountsLoading } = useListAccountsByCompany(myCompany?.id, {
    enabled: !!myCompany?.id,
  });
  const { data: teamStats } = useGetTeamStats(myCompany?.id);

  const isAdmin = user?.teamMembership?.role === "ADMIN" || user?.teamMembership?.role === "OWNER";

  const accounts: Account[] = (multisigAccounts || []).map(a => ({
    id: a.accountId,
    name: a.name,
    description: a.description || `Threshold ${a.threshold} · ${a.publicKeys.length} approvers`,
    memberCount: a.publicKeys.length,
    logo: a.logo ? a.logo : "/client-invoice/payroll-icon.svg",
  }));

  const handleCreateNewAccount = () => {
    openModal("CREATE_ACCOUNT");
  };

  const handleMenuClick = (accountId: string) => {
    console.log("Menu clicked for account:", accountId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "account":
        return (
          <AccountTab
            accounts={accounts}
            onCreateNewAccount={handleCreateNewAccount}
            onMenuClick={handleMenuClick}
            isAdmin={isAdmin}
          />
        );
      case "member":
        return <MemberTab onMenuClick={handleMenuClick} />;
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header Section */}
      <div className="flex items-center justify-between w-full">
        <div className="flex gap-3 items-center">
          <CompanyAvatar logo={myCompany?.logo} companyName={myCompany?.companyName} size="w-12" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-text-primary leading-none">{myCompany?.companyName}</h1>
            <p className="text-xs font-medium text-text-secondary leading-none">{teamStats?.total} members</p>
          </div>
        </div>
        {isAdmin && (
          <PrimaryButton
            text="Add new members"
            icon="/misc/plus-icon.svg"
            iconPosition="left"
            onClick={() => openModal("INVITE_TEAM_MEMBER")}
            containerClassName="w-[160px]"
          />
        )}
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 w-full">
        {/* Account Stats Card */}
        <Card title="Accounts" amount={accounts.length.toString()} info="Admins can submit proposals and cast votes." />

        {/* Member Stats Card */}
        <Card title="Members" amount={teamStats?.total.toString() || "0"} />
      </div>

      {/* Tabs */}
      {/** Employee or Client tab */}
      <div className="w-full flex flex-row border-b border-primary-divider relative">
        <div
          className="flex items-center justify-center px-10 py-3 w-[250px] cursor-pointer group transition-colors duration-300"
          onClick={() => setActiveTab("account")}
        >
          <p
            className={`font-medium text-base leading-6 transition-colors duration-300 ${
              activeTab === "account" ? "text-text-strong-950" : "text-text-soft-400 group-hover:text-text-soft-500"
            }`}
          >
            Multi-Owner Accounts
          </p>
        </div>
        <div
          className="flex items-center justify-center px-10 py-3 w-[250px] cursor-pointer transition-colors duration-300"
          onClick={() => setActiveTab("member")}
        >
          <p
            className={`font-medium text-base leading-6 transition-colors duration-300 ${
              activeTab === "member" ? "text-text-strong-950" : "text-text-soft-400"
            }`}
          >
            Company Member
          </p>
        </div>
        <div
          className="absolute bottom-0 h-[3px] bg-primary-blue transition-all duration-300"
          style={{
            width: "250px",
            left: activeTab === "account" ? "0px" : "250px",
          }}
        />
      </div>

      {renderTabContent()}
    </div>
  );
};

export default TeamSettings;
