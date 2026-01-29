"use client";
import React, { useEffect, useState } from "react";
import { useGetBatchAccountBalances, useListAccountsByCompany } from "@/services/api/multisig";
import { useGetMyCompany } from "@/services/api/company";
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

const UpcomingPayrollCard = ({ text, subtitle, icon }: { text: string; subtitle: string; icon: string }) => {
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

      <div className="flex flex-row gap-2 w-full  ">
        <div className="px-3 py-1 bg-app-background rounded-full flex flex-row gap-1 items-center flex-none w-fit">
          <img src="/card/calendar-icon-light.svg" alt="token icon" className="w-4" />
          <span className="leading-none font-medium text-sm text-text-secondary">Due on</span>
          <span className="leading-none">Dec 1st, 2025</span>
        </div>

        <div className="px-3 py-1 bg-app-background rounded-full flex flex-row gap-1 items-center flex-none w-fit">
          {/* <img src="/token/qash.svg" alt="token icon" className="w-5 flex-shrink-0" /> */}
          <span className="leading-none">15 Payees</span>
        </div>
      </div>
    </div>
  );
};

export const CardContainer = () => {
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts } = useListAccountsByCompany(myCompany?.id, { enabled: !!myCompany?.id });
  const getBalances = useGetBatchAccountBalances();
  const [treasuryStats, setTreasuryStats] = useState<AccountBalanceStatDto | undefined>();

  useEffect(() => {
    if (multisigAccounts && multisigAccounts.length !== 0) {
      (async () => {
        const { accounts } = await getBalances.mutateAsync({
          accountIds: multisigAccounts.map(acc => acc.accountId),
        });

        // Aggregate stats from all accounts
        const aggregatedTokens = new Map<string, { symbol?: string; amount: number; amountUSD: number }>();
        let totalUSD = 0;

        for (const account of accounts) {
          totalUSD += account.stats.totalUSD;
          for (const token of account.stats.tokens) {
            const key = token.faucetId;
            if (aggregatedTokens.has(key)) {
              const existing = aggregatedTokens.get(key)!;
              existing.amount += token.amount;
              existing.amountUSD += token.amountUSD;
            } else {
              aggregatedTokens.set(key, {
                symbol: token.symbol,
                amount: token.amount,
                amountUSD: token.amountUSD,
              });
            }
          }
        }

        const aggregatedStats: AccountBalanceStatDto = {
          totalUSD,
          tokens: Array.from(aggregatedTokens.entries()).map(([faucetId, data]) => ({
            faucetId,
            symbol: data.symbol,
            amount: data.amount,
            amountUSD: data.amountUSD,
          })),
        };

        setTreasuryStats(aggregatedStats);
      })();
    }
  }, [multisigAccounts]);

  return (
    <div className="w-full flex flex-row gap-2">
      <TreasuryCard
        text="Total Treasury Balance"
        subtitle={`$${treasuryStats?.totalUSD.toFixed(2) ?? "0.00"}`}
        icon="/card/treasury-icon.svg"
        stats={treasuryStats}
      />
      <UpcomingPayrollCard text="Upcoming Payroll" subtitle="$42,500" icon="/card/calendar-icon.svg" />
    </div>
  );
};
