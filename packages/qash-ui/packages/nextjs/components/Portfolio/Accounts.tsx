"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { useListAccountsByCompany } from "@/services/api/multisig";
import { useGetMyCompany } from "@/services/api/company";

// Account data type
interface Account {
  id: string;
  name: string;
  label: string;
  balance: string;
  avatar: {
    backgroundColor: string;
    icon: string;
  };
  isSelected?: boolean;
}

interface AccountsProps {
  accounts?: Account[];
  onAccountSelect?: (account: Account) => void;
}

// Sample icon/image assets
const searchIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E";
const profileIcon =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

const Accounts: React.FC<AccountsProps> = ({ accounts, onAccountSelect }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: company } = useGetMyCompany();

  // Fetch accounts from API
  const { data: apiAccounts = [], isLoading } = useListAccountsByCompany(company?.id, { enabled: !!company?.id });

  // Avatar colors for visual variety
  const avatarColors = ["#068DFF", "#3FDEC9", "#8C71F6", "#FF6B6B", "#FFA500"];

  // Transform API accounts to component format
  const transformedAccounts: Account[] = useMemo(() => {
    return apiAccounts.map((apiAccount, index) => ({
      id: apiAccount.accountId,
      name: apiAccount.accountId.substring(0, 12) + "...",
      label: apiAccount.name,
      balance: "$ 0.00", // TODO: Fetch balance from API
      avatar: {
        backgroundColor: avatarColors[index % avatarColors.length],
        icon: profileIcon,
      },
      isSelected: index === 0,
    }));
  }, [apiAccounts]);

  const displayAccounts = accounts || transformedAccounts;

  // Filter accounts based on search query
  const filteredAccounts = displayAccounts.filter(
    account =>
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAccountClick = (account: Account) => {
    if (onAccountSelect) {
      onAccountSelect(account);
    }
  };

  return (
    <div className="w-full h-full flex items-center bg-background rounded-2xl flex-col gap-4 p-5 flex-1">
      {/* Search Bar */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-app-background border border-primary-divider w-full">
        <input
          type="text"
          placeholder="Search by name"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-text-primary placeholder-text-secondary outline-none text-sm"
        />
        <img src="/misc/blue-search-icon.svg" alt="search" className="w-3.5 h-3.5" />
      </div>

      {/* Accounts List */}
      <div className="flex flex-col gap-0 w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-text-secondary">Loading accounts...</div>
        ) : filteredAccounts.length > 0 ? (
          filteredAccounts.map((account, index) => (
            <div
              key={account.id}
              onClick={() => handleAccountClick(account)}
              className={`flex items-center gap-3 p-4 cursor-pointer transition-all ${
                account.isSelected
                  ? "bg-[rgba(6,110,255,0.1)] border-l-4 border-[#066EFF] rounded-sm"
                  : "hover:bg-[rgba(255,255,255,0.05)]"
              }`}
            >
              {/* Avatar */}
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: account.avatar.backgroundColor }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white" className="w-8 h-8">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>

              {/* Account Info */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <p className="text-[16px] font-semibold leading-6 truncate">{account.name}</p>
                <p
                  className={`text-[14px] font-medium leading-5 truncate ${
                    account.isSelected ? "text-primary-blue" : "text-text-secondary"
                  }`}
                >
                  {account.label}
                </p>
              </div>

              {/* Balance */}
              <div className="flex flex-col items-end justify-center flex-shrink-0">
                <p className="text-[16px] font-medium leading-6 whitespace-nowrap">{account.balance}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-8 text-text-secondary">No accounts found</div>
        )}
      </div>
    </div>
  );
};

export default Accounts;
