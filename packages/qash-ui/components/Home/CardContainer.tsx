"use client";
import React, { useMemo } from "react";
import { useMultisigAssets, useListAccountsByCompany } from "@/services/api/multisig";
import { useGetMyCompany } from "@/services/api/company";
import { useGetPayrollStats } from "@/services/api/payroll";
import type { AccountBalanceStatDto } from "@qash/types/dto/multisig";

const formatCompact = (value: number | string) => {
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, ""));
  if (Number.isNaN(num)) return String(value);
  const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
  return formatter.format(num);
};

const TokenBadge = ({ token, amount }: { token: string; amount: string | number }) => {
  const displayAmount = formatCompact(amount);

  return (
    <div className="px-3 py-1 bg-app-background rounded-full flex flex-row gap-1 items-center flex-none w-fit">
      <img src="/token/qash.svg" alt="token icon" className="w-5 flex-shrink-0" />
      <span className="leading-none font-medium truncate">{displayAmount}</span>
      <span className="leading-none">{token}</span>
    </div>
  );
};

const TreasuryCard = ({
  text,
  subtitle,
  icon,
  stats,
}: {
  text: string;
  subtitle: string;
  icon: string;
  stats?: AccountBalanceStatDto;
}) => {
  return (
    <div
      className="w-full min-w-[327px] h-[180px] bg-background rounded-[12px] flex flex-col gap-1 border border-primary-divider p-3 justify-between"
      style={{
        backgroundImage: `url(/card/background.svg)`,
        backgroundSize: "contain",
        backgroundPosition: "right",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex flex-col gap-1">
        <img src={icon} alt="background" className="w-10 h-10" />
        <span className="text-text-secondary text-sm">{text}</span>
        <span className="text-text-primary text-3xl font-bold">{subtitle}</span>
      </div>

      <div className="flex flex-row gap-2 w-full overflow-x-auto ">
        {stats && stats.tokens.length > 0 ? (
          stats.tokens.map(token => (
            <TokenBadge key={token.faucetId} token={token.symbol || "Token"} amount={token.amount.toFixed(2)} />
          ))
        ) : (
          <>
            <TokenBadge token="QASH" amount="0.00" />
            <TokenBadge token="USD" amount="0.00" />
          </>
        )}
      </div>
    </div>
  );
};

function formatPayDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).replace(",", ` ${day}${suffix},`);
}

const UpcomingPayrollCard = ({
  text,
  subtitle,
  icon,
  nextPayDate,
  totalPayees,
}: {
  text: string;
  subtitle: string;
  icon: string;
  nextPayDate: string | null;
  totalPayees: number;
}) => {
  return (
    <div
      className="w-full min-w-[327px] h-[180px] bg-background rounded-[12px] flex flex-col gap-1 border border-primary-divider p-3 justify-between"
      style={{
        backgroundImage: `url(/card/background.svg)`,
        backgroundSize: "contain",
        backgroundPosition: "right",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex flex-col gap-1">
        <img src={icon} alt="background" className="w-10 h-10" />
        <span className="text-text-secondary text-sm">{text}</span>
        <span className="text-text-primary text-3xl font-bold">{subtitle}</span>
      </div>

      <div className="flex flex-row gap-2 w-full">
        {nextPayDate ? (
          <div className="px-3 py-1 bg-app-background rounded-full flex flex-row gap-1 items-center flex-none w-fit">
            <img src="/card/calendar-icon-light.svg" alt="calendar icon" className="w-4" />
            <span className="leading-none font-medium text-sm text-text-secondary">Due on</span>
            <span className="leading-none">{formatPayDate(nextPayDate)}</span>
          </div>
        ) : (
          <div className="px-3 py-1 bg-app-background rounded-full flex flex-row gap-1 items-center flex-none w-fit">
            <span className="leading-none text-sm text-text-secondary">No upcoming payroll</span>
          </div>
        )}

        <div className="px-3 py-1 bg-app-background rounded-full flex flex-row gap-1 items-center flex-none w-fit">
          <span className="leading-none">{totalPayees} {totalPayees === 1 ? "Payee" : "Payees"}</span>
        </div>
      </div>
    </div>
  );
};

export const CardContainer = () => {
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts } = useListAccountsByCompany(myCompany?.id, { enabled: !!myCompany?.id });

  const accountIds = multisigAccounts?.map(acc => acc.accountId);
  const { data: assetsData } = useMultisigAssets(accountIds);
  const { data: payrollStats } = useGetPayrollStats();

  const treasuryStats: AccountBalanceStatDto | undefined = useMemo(() => {
    if (!assetsData) return undefined;
    return {
      totalUSD: assetsData.totalUsd,
      tokens: assetsData.balances.map(b => ({
        faucetId: b.assetId,
        symbol: b.symbol,
        amount: parseFloat(b.balance) || 0,
        amountUSD: parseFloat(b.balance) || 0,
      })),
    };
  }, [assetsData]);

  const payrollAmount = payrollStats
    ? `$${formatCompact(payrollStats.totalMonthlyAmount)}`
    : "$0.00";

  return (
    <div id="tour-cards" className="w-full flex flex-row gap-2">
      <TreasuryCard
        text="Total Treasury Balance"
        subtitle={`$${treasuryStats?.totalUSD.toFixed(2) ?? "0.00"}`}
        icon="/card/treasury-icon.svg"
        stats={treasuryStats}
      />
      <UpcomingPayrollCard
        text="Upcoming Payroll"
        subtitle={payrollAmount}
        icon="/card/calendar-icon.svg"
        nextPayDate={payrollStats?.nextPayDate ?? null}
        totalPayees={payrollStats?.totalPayees ?? 0}
      />
    </div>
  );
};
