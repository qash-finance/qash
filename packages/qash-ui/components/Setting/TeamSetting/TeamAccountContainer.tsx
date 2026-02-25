"use client";

import { useModal } from "@/contexts/ModalManagerProvider";
import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import AccountTab, { Account } from "../TeamSetting/AccountTab";
import MemberTab from "./MemberTab";
import { PrimaryButton } from "@/components/Common/PrimaryButton";
import Card from "@/components/Common/Card";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import AccountCard from "./AccountCard";
import MemberCard from "./MemberCard";
import { useGetMultisigAccount, useGetAccountMembers } from "@/services/api/multisig";
import { useRemoveTeamMember } from "@/services/api/team-member";
import toast from "react-hot-toast";
import { useGetMyCompany } from "@/services/api/company";
import { TeamMemberRoleEnum } from "@qash/types/enums";

// Map server role enum to UI labels
const mapRole = (role?: string): TeamMemberRoleEnum[] => {
  if (!role) return [];
  switch (role) {
    case "OWNER":
      return [TeamMemberRoleEnum.OWNER];
    case "ADMIN":
      return [TeamMemberRoleEnum.ADMIN];
    case "REVIEWER":
      return [TeamMemberRoleEnum.REVIEWER];
    case "VIEWER":
      return [TeamMemberRoleEnum.VIEWER];
    default:
      return [TeamMemberRoleEnum.VIEWER];
  }
};

const TeamAccountContainer = () => {
  const { openModal } = useModal();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("team-account") || undefined;
  const removeTeamMember = useRemoveTeamMember();
  const { data: myCompany } = useGetMyCompany();

  const { data: account, isLoading: accountLoading } = useGetMultisigAccount(accountId, { enabled: !!accountId });
  const { data: accountMembers, isLoading: membersLoading } = useGetAccountMembers(accountId, { enabled: !!accountId });

  const handleAddMembers = () => {
    console.log("Add new members");
  };

  const onMenuClick = (accountId: string) => {};

  const members = (accountMembers?.members || []).map((m: any) => ({
    id: String(m.id),
    name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
    email: m.email,
    companyRole: m.position || "",
    role: mapRole(m.role),
  }));

  return (
    <div className="flex flex-col gap-5 w-[900px]">
      {/* Header Section */}
      <div className="flex flex-row gap-3">
        <img
          src="/arrow/thin-arrow-left.svg"
          alt="Back"
          className="w-6 h-6 cursor-pointer"
          onClick={() => window.history.back()}
        />
        <span className="text-text-secondary">{myCompany?.companyName}</span> / <span>{account?.name}</span>
      </div>
      <div className="flex items-center justify-between w-full">
        <div className="flex gap-3 items-center">
          <img
            src={account?.logo ? account.logo : "/client-invoice/payroll-icon.svg"}
            alt="Team Avatar"
            className="w-12"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-text-primary leading-none">{account?.name}</h1>
            <p className="text-xs font-medium text-text-secondary leading-none">{(members || []).length} members</p>
          </div>
        </div>

        {/* <div className="flex flex-row gap-2 w-fit">
          <SecondaryButton
            text="Deposit"
            icon="/arrow/thin-arrow-down.svg"
            iconPosition="left"
            onClick={() => openModal("DEPOSIT")}
            buttonClassName="py-1 w-fit px-3"
          />

          <PrimaryButton
            text="Add new members"
            icon="/misc/plus-icon.svg"
            iconPosition="left"
            onClick={handleAddMembers}
            containerClassName="w-[160px]"
          />

          <SecondaryButton
            text="Edit account"
            icon="/misc/edit-icon.svg"
            iconPosition="left"
            onClick={() => {}}
            variant="light"
            buttonClassName="py-1 w-fit px-3"
          />
        </div> */}
      </div>

      {/* Stats Cards */}
      <div className="flex gap-4 w-full">
        {/* Account Stats Card */}
        <Card title="Member" amount={(members || []).length.toString()} />

        {/* Member Stats Card */}
        <Card title="Threshold" amount={account?.threshold?.toString() || "-"} />
      </div>

      <div className="w-full flex justify-between items-center">
        <span className="text-2xl font-bold">Multi-Owner Account Member</span>
        {/* <div className="bg-app-background border border-primary-divider flex flex-row gap-2 items-center pr-1 pl-3 py-1 rounded-lg w-[300px]">
          <div className="flex flex-row gap-2 flex-1">
            <input
              type="text"
              placeholder="Search by name"
              className="font-medium text-sm text-text-secondary bg-transparent border-none outline-none w-full"
            />
          </div>
          <button
            type="button"
            className="flex flex-row gap-1.5 items-center rounded-lg w-6 h-6 justify-center cursor-pointer"
          >
            <img src="/wallet-analytics/finder.svg" alt="search" className="w-4 h-4" />
          </button>
        </div> */}
      </div>

      {/* Members Cards Grid */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {(accountMembers?.members || []).map((m: any) => {
          const member = {
            id: String(m.id),
            name: m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim(),
            email: m.email,
            companyRole: m.position || "",
            role: mapRole(m.role),
            status: m.status,
            profilePicture: m.profilePicture,
          };

          const handleEdit = () => openModal("EDIT_TEAM_MEMBER", { id: Number(m.id) });

          const handleRemove = () => {
            openModal("REMOVE_TEAM_MEMBER", {
              name: `${m.firstName || ""} ${m.lastName || ""}`.trim(),
              onRemove: async () => {
                try {
                  if (!account?.companyId) throw new Error("Company ID missing");
                  await removeTeamMember.mutateAsync({
                    teamMemberId: Number(m.id),
                    companyId: Number(account.companyId),
                  });
                  toast.success("Team member removed");
                } catch (err) {
                  console.error("Failed to remove team member", err);
                  toast.error("Failed to remove member");
                }
              },
            });
          };

          return <MemberCard key={member.id} member={member} onMenuClick={onMenuClick} />;
        })}
      </div>
    </div>
  );
};

export default TeamAccountContainer;
