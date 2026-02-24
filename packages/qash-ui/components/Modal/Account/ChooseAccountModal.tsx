"use client";
import React, { useState, useMemo } from "react";
import { ModalProp } from "@/contexts/ModalManagerProvider";
import BaseModal from "../BaseModal";
import { SecondaryButton } from "@/components/Common/SecondaryButton";
import { PrimaryButton } from "@/components/Common/PrimaryButton";
import { ModalHeader } from "@/components/Common/ModalHeader";
import { MultisigAccountResponseDto } from "@qash/types/dto/multisig";
import { ChooseAccountModalProps } from "@/types/modal";
import { useGetMyCompany } from "@/services/api/company";
import { useListAccountsByCompany } from "@/services/api/multisig";

const generateRandomColor = (): string => {
  const colors = [
    "#3FDEC9",
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B88B",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

interface AccountRowProps {
  account: MultisigAccountResponseDto;
  isSelected: boolean;
  onSelect: (accountId: string) => void;
  icon?: string;
  backgroundColor?: string;
}

function AccountAvatar({ fillColor }: { fillColor: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.39966e-10 6.71171C6.19104e-10 3.00494 3.00493 0 6.71171 1.43292e-10L25.2883 5.39894e-10C28.9951 6.19032e-10 32 3.00493 32 6.71171L32 25.2883C32 28.9951 28.9951 32 25.2883 32L6.71171 32C3.00494 32 0 28.9951 1.43364e-10 25.2883L5.39966e-10 6.71171Z"
        fill={fillColor}
      />
      <path
        d="M13.8035 11.3982L15.7148 13.3094C15.9979 13.5926 16.5642 13.5926 16.8474 13.3094L18.7586 11.3982C19.2541 10.9027 18.9002 9.98242 18.1923 9.98242H14.3698C13.6619 10.0532 13.308 10.9027 13.8035 11.3982Z"
        stroke="white"
        stroke-width="1.06181"
        stroke-miterlimit="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M13.8035 21.1666L15.7148 19.2553C15.9979 18.9722 16.5642 18.9722 16.8474 19.2553L18.7586 21.1666C19.2541 21.6621 18.9002 22.5823 18.1923 22.5823H14.3698C13.6619 22.5116 13.308 21.6621 13.8035 21.1666Z"
        stroke="white"
        stroke-width="1.06181"
        stroke-miterlimit="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M9.34384 15.9278L10.9012 13.4502C11.1135 13.0255 11.6798 12.9547 12.0338 13.3086L14.5113 15.7862C14.7945 16.0694 14.7945 16.4941 14.5113 16.7772L12.0338 19.2548C11.6798 19.6087 11.1843 19.538 10.9012 19.1132L9.34384 16.6357C9.13148 16.4233 9.13148 16.1402 9.34384 15.9278Z"
        stroke="white"
        stroke-width="1.06181"
        stroke-miterlimit="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M23.2182 15.9286L21.6609 13.4511C21.4485 13.0971 20.8822 13.0263 20.5283 13.3095L18.0507 15.787C17.7676 16.0702 17.7676 16.4949 18.0507 16.7781L20.5283 19.2556C20.8822 19.6096 21.3778 19.5388 21.6609 19.1141L23.2182 16.6365C23.4306 16.4241 23.4306 16.141 23.2182 15.9286Z"
        stroke="white"
        stroke-width="1.06181"
        stroke-miterlimit="10"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function AccountRow({ account, isSelected, onSelect, icon, backgroundColor = "bg-blue-500" }: AccountRowProps) {
  const randomColor = useMemo(() => generateRandomColor(), []);

  return (
    <button
      onClick={() => onSelect(account.accountId)}
      className="w-full flex gap-3 items-center px-3 py-3 rounded-xl bg-surface border border-primary-divider hover:border-primary-blue transition-colors"
    >
      {/* Radio Button */}
      <div
        className="relative shrink-0 w-6 h-6 rounded-full border-2 border-primary-divider flex items-center justify-center transition-all"
        style={{
          borderColor: isSelected ? "rgb(6, 110, 255)" : "var(--primary-divider)",
          background: isSelected ? "rgb(6, 110, 255)" : "transparent",
        }}
      >
        {isSelected && (
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )}
      </div>

      {/* Avatar and Info */}
      <div className="flex gap-2 items-center flex-1 min-w-0">
        {/* Avatar */}
        <img
          src={account.logo ? account.logo : "/client-invoice/payroll-icon.svg"}
          alt={`${account.name} avatar`}
          className="w-10 h-10 rounded-lg"
        />

        {/* Account Details */}
        <div className="flex flex-col items-start min-w-0 flex-1">
          <h3 className="text-base font-medium text-text-primary leading-6">{account.name}</h3>
          <p className="text-xs font-normal text-text-secondary leading-4 line-clamp-2">
            {account.description || "No description"}
          </p>
        </div>
      </div>
    </button>
  );
}

export function ChooseAccountModal({
  isOpen,
  onClose,
  zIndex,
  onSelectAccount,
  onConfirm,
}: ModalProp<ChooseAccountModalProps>) {
  const { data: myCompany } = useGetMyCompany();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const { data: accounts = [], isLoading: accountsLoading } = useListAccountsByCompany(myCompany?.id, {
    enabled: !!myCompany?.id,
  });

  const handleSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = accounts.find(a => a.accountId === accountId);
    if (account && onSelectAccount) {
      onSelectAccount(account);
    }
  };

  const handleConfirm = () => {
    if (selectedAccountId) {
      const account = accounts.find(a => a.accountId === selectedAccountId);
      if (account && onConfirm) {
        onConfirm(account);
      }
      onClose();
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
      <div className="flex w-125 flex-col rounded-2xl pb-5">
        <ModalHeader title="Choose an account" onClose={onClose} />

        <div className="flex flex-col gap-3 rounded-b-2xl h-auto max-h-96 bg-background border-t border-2 border-primary-divider p-5 overflow-y-auto">
          {accounts.length > 0 ? (
            accounts.map(account => (
              <AccountRow
                key={account.accountId}
                account={account}
                isSelected={selectedAccountId === account.accountId}
                onSelect={handleSelect}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-8 text-text-secondary">No accounts available</div>
          )}

          <div className="flex flex-row gap-2">
            <SecondaryButton text="Cancel" onClick={onClose} variant="light" />
            <PrimaryButton text="Confirm" onClick={handleConfirm} disabled={!selectedAccountId} />
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

export default ChooseAccountModal;
