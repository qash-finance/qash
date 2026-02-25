"use client";
import React from "react";
import { CardContainer } from "./CardContainer";
import { Overview } from "./Overview";
import { PageHeader } from "../Common/PageHeader";
import { usePSMProvider } from "@/contexts/PSMProvider";
import { useGetMyCompany } from "@/services/api/company";
import { useListAccountsByCompany } from "@/services/api/multisig";

const SyncBanner = () => {
  const { psmStatus, accountCacheMap, error } = usePSMProvider();
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts } = useListAccountsByCompany(myCompany?.id, { enabled: !!myCompany?.id });

  const totalAccounts = multisigAccounts?.length ?? 0;
  const loadedAccounts = accountCacheMap.size;

  if (totalAccounts === 0) return null;
  if (psmStatus === "connected" && loadedAccounts >= totalAccounts) return null;

  const isError = psmStatus === "error" || !!error;
  const isConnecting = psmStatus === "connecting";
  const progress = totalAccounts > 0 ? Math.round((loadedAccounts / totalAccounts) * 100) : 0;

  let message = "";
  if (isError) {
    message = "Having trouble connecting. Retrying...";
  } else if (isConnecting) {
    message = "Connecting to sync service...";
  } else if (loadedAccounts < totalAccounts) {
    message = `Syncing wallet data... ${loadedAccounts} of ${totalAccounts} accounts`;
  }

  if (!message) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary-divider bg-background">
      <div className="relative w-5 h-5 flex-shrink-0">
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="var(--primary-divider)" strokeWidth="2.5" />
          <path
            d="M18 10a8 8 0 0 0-8-8"
            stroke="var(--primary-blue)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary font-medium">{message}</p>
      </div>
      {!isError && !isConnecting && totalAccounts > 0 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-24 h-1.5 rounded-full bg-primary-divider overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, backgroundColor: "var(--primary-blue)" }}
            />
          </div>
          <span className="text-xs text-text-secondary tabular-nums">{progress}%</span>
        </div>
      )}
    </div>
  );
};

export const HomeContainer = () => {
  return (
    <div className="w-full h-full p-5 flex flex-col items-start gap-4">
      <div className="w-full flex flex-col gap-4 px-5">
        <PageHeader icon="/sidebar/home.svg" label="Dashboard" button={null} />
        <SyncBanner />
        <CardContainer />
      </div>
      <Overview />
    </div>
  );
};
