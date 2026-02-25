"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { MultisigAccountResponseDto } from "@qash/types/dto/multisig";

interface MultisigAccountCardProps {
  account: MultisigAccountResponseDto;
  memberCount?: number;
}

export default function MultisigAccountCard({ account, memberCount = 0 }: MultisigAccountCardProps) {
  const router = useRouter();

  const handleViewAccount = () => {
    router.push(`/setting?team-account=${account.accountId}`);
  };

  return (
    <div className="bg-app-background flex flex-col gap-5 items-start justify-center p-3 relative rounded-[16px] w-full">
      <div className="flex flex-col gap-3 items-start w-full">
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-2 items-center flex-1">
            {/* Avatar */}
            <img
              src={account.logo ? account.logo : "/client-invoice/payroll-icon.svg"}
              alt="Account Avatar"
              className={`w-10 h-10 `}
            />

            {/* Account Info */}
            <div className="flex flex-col gap-1 items-start justify-center flex-1">
              {/* Account Name */}
              <div className="text-base font-semibold leading-5">{account.name}</div>

              {/* Member Count and Threshold */}
              <div className="flex gap-2 items-center">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="text-xs font-medium text-text-sub-600">{memberCount} members</span>
              </div>
            </div>
          </div>

          {/* View Button */}
          <button
            onClick={handleViewAccount}
            className="bg-[#E7E7E7] flex gap-2 items-center px-3 py-1 relative rounded-lg hover:bg-surface-700 transition-colors cursor-pointer"
          >
            <span className="text-sm font-medium text-text-strong-950 text-center">View</span>
          </button>
        </div>
      </div>
    </div>
  );
}
