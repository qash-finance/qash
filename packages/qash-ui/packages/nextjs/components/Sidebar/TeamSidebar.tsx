"use client";
import React, { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MOVE_CRYPTO_SIDEBAR_OFFSET } from "./Sidebar";
import { PrimaryButton } from "../Common/PrimaryButton";
import { SecondaryButton } from "../Common/SecondaryButton";
import { useGetTeamStats } from "@/services/api/team-member";
import { useGetMyCompany } from "@/services/api/company";
import { useGetAccountBalances, useListAccountsByCompany } from "@/services/api/multisig";
import MultisigAccountCard from "./MultisigAccountCard";
import { useModal } from "@/contexts/ModalManagerProvider";

interface TeamSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TeamSidebar({ isOpen, onClose }: TeamSidebarProps) {
  const pathname = usePathname();
  const { openModal } = useModal();
  const { data: myCompany } = useGetMyCompany();
  const { data: teamStats } = useGetTeamStats(myCompany?.id, { enabled: !!myCompany?.id });
  const { data: multisigAccounts, isLoading: accountsLoading } = useListAccountsByCompany(myCompany?.id, {
    enabled: !!myCompany?.id,
  });

  // Close sidebar when route changes
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [pathname]);

  const handleCreateNewAccount = () => {
    openModal("CREATE_ACCOUNT");
  };

  const handleAddMember = () => {
    openModal("INVITE_TEAM_MEMBER");
  };

  return (
    <>
      {/* Backdrop overlay for click outside detection */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[5] bg-transparent"
          onClick={onClose}
          style={{
            pointerEvents: isOpen ? "auto" : "none",
          }}
        />
      )}
      <div
        className="absolute top-0 h-[100%] w-[400px] z-5 rounded-tr-lg rounded-br-lg p-4 flex flex-col gap-4 transition-all duration-300 ease-in-out overflow-y-auto bg-background"
        style={{
          left: isOpen ? `${MOVE_CRYPTO_SIDEBAR_OFFSET}px` : "-20px",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          pointerEvents: isOpen ? "auto" : "none",
          boxShadow: isOpen ? "50px 0 50px rgba(0,0,0,0.15)" : "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="flex flex-col gap-4 mt-8">
          {/* Team Avatar and Info */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
              <img
                alt="Team Avatar"
                className="w-10"
                src={myCompany?.logo ? myCompany.logo : "/logo/qash-icon-dark.svg"}
              />
              <img
                alt="cheveron Left"
                className="w-5 cursor-pointer"
                src="/arrow/double-chevron-left.svg"
                onClick={onClose}
              />
            </div>

            <h2 className="text-[24px] font-medium leading-[24px] text-text-primary">{myCompany?.companyName}</h2>

            {/* Team Members Tab */}
            <div className="flex gap-2 items-center">
              {/* <div className="flex items-center -space-x-2">
                <div className="relative rounded-full w-5 h-5 border-2 border-app-background">
                  <img alt="Team member 1" className="w-full h-full object-cover rounded-full" src={imgAva3} />
                </div>
                <div className="relative rounded-full w-5 h-5 border-2 border-app-background">
                  <img alt="Team member 2" className="w-full h-full object-cover rounded-full" src={imgAva4} />
                </div>
                <div className="relative rounded-full w-5 h-5 border-2 border-app-background">
                  <img alt="Team member 3" className="w-full h-full object-cover rounded-full" src={imgAva5} />
                </div>
              </div> */}
              <span className="text-xs font-medium text-text-secondary">{teamStats?.total || 0} members</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-row gap-2">
          <PrimaryButton
            text="Create new account"
            icon="/misc/circle-plus-icon.svg"
            iconPosition="left"
            onClick={handleCreateNewAccount}
          />
          <SecondaryButton text="Add member" icon="/misc/plus-icon.svg" iconPosition="left" onClick={handleAddMember} />
        </div>

        {/* Multisig Accounts Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-text-primary">Multisig Accounts</h3>
            <span className="text-sm font-medium text-text-secondary">{multisigAccounts?.length || 0}</span>
          </div>

          {multisigAccounts && multisigAccounts.length > 0 ? (
            <div className="flex flex-col gap-1 w-full">
              {multisigAccounts.map(account => (
                <MultisigAccountCard key={account.uuid} account={account} memberCount={account.publicKeys.length} />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center gap-3 py-10 px-4">
              <img alt="Empty State Icon" className="w-32" src="/misc/hexagon-multisig-icon.svg" />
              <p className="text-center text-text-secondary max-w-xs leading-none">
                You don't have a multisig account yet.
              </p>
              <p className="text-center text-text-secondary max-w-xs leading-none">Create one now.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
