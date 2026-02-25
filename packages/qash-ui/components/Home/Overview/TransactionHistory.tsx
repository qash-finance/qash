"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useListAccountsByCompany, useLocalAccountBalances, useListProposalsByCompany } from "@/services/api/multisig";
import { useGetMyCompany } from "@/services/api/company";
import { formatUnits } from "viem";
import Link from "next/link";
import type { MultisigProposalResponseDto, MultisigAccountResponseDto } from "@qash/types";
import { QASH_TOKEN_ADDRESS } from "@/services/utils/constant";
import { formatNumberWithCommas } from "@/services/utils/formatNumber";
import { supportedTokens } from "@/services/utils/supportedToken";
import { blo } from "blo";
import { turnBechToHex } from "@/services/utils/turnBechToHex";
import { usePSMProvider, type EnrichedBalance } from "@/contexts/PSMProvider";
import { useMidenProvider } from "@/contexts/MidenProvider";
import { getFaucetMetadata } from "@/services/utils/miden/faucet";
import type { FaucetMetadata } from "@/types/faucet";

interface Account {
  id: string;
  name: string;
  percentage: number;
  balance: string;
  color: string;
}

interface TokenMeta {
  symbol: string;
  decimals: number;
  bech32?: string;
}

const chartColors = ["#6366f1", "#3b82f6", "#60a5fa", "#93c5fd", "#a78bfa", "#c084fc"];

function formatDate(raw: string | Date): string {
  const d = new Date(raw);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function truncateId(id: string, len = 10): string {
  if (id.length <= len) return id;
  return id.slice(0, len) + "...";
}

function getTokenLogo(tokenAddress?: string, bech32Address?: string): string {
  if (!tokenAddress && !bech32Address) return "/token/any-token.svg";
  const addrForCompare = bech32Address || tokenAddress || "";
  const normalizedQash = QASH_TOKEN_ADDRESS.split("_")[0];
  const normalizedAddr = addrForCompare.split("_")[0];
  if (normalizedQash === normalizedAddr) return "/token/qash.svg";
  const known = supportedTokens.find(t => normalizedAddr.startsWith(t.faucetId.split("_")[0]));
  if (known) return `/token/${known.symbol.toLowerCase()}.svg`;
  try {
    const hex = bech32Address ? turnBechToHex(bech32Address) : turnBechToHex(tokenAddress || "");
    return blo(hex);
  } catch {
    return "/token/any-token.svg";
  }
}

/**
 * Derive a human-readable transaction row from an executed proposal.
 * tokenMetaMap provides resolved symbol/decimals for hex faucet addresses.
 */
function proposalToRow(
  proposal: MultisigProposalResponseDto,
  accountMap: Map<string, MultisigAccountResponseDto>,
  allEnrichedBalances: EnrichedBalance[],
  tokenMetaMap: Map<string, TokenMeta>,
) {
  const isOutgoing = proposal.proposalType === "SEND";
  const token = proposal.tokens?.[0];
  const tokenAddress = token?.address || proposal.faucetId || "";
  const tokenAddrLower = tokenAddress.toLowerCase();

  // 1. Try enriched balances from PSM cache
  const enriched = tokenAddress
    ? allEnrichedBalances.find(eb => eb.faucetId.toLowerCase() === tokenAddrLower)
    : undefined;

  // 2. Try supportedTokens by bech32
  const bech32Addr = enriched?.faucetBech32 || "";
  const knownToken = bech32Addr
    ? supportedTokens.find(t => bech32Addr.startsWith(t.faucetId.split("_")[0]))
    : undefined;

  // 3. Try resolved metadata from SDK (getFaucetMetadata)
  const resolvedMeta = tokenMetaMap.get(tokenAddrLower);

  const symbol = enriched?.symbol || knownToken?.symbol || resolvedMeta?.symbol || token?.symbol || "TOKEN";
  const decimals = enriched?.decimals ?? knownToken?.decimals ?? resolvedMeta?.decimals ?? token?.decimals ?? 8;
  const resolvedBech32 = bech32Addr || resolvedMeta?.bech32 || "";

  // Resolve raw amount string (BigInt-safe)
  let rawAmountStr = "0";
  if (proposal.payments?.length) {
    const total = proposal.payments.reduce((sum, p) => sum + BigInt(p.amount || 0), BigInt(0));
    rawAmountStr = total.toString();
  } else if (proposal.amount) {
    rawAmountStr = proposal.amount;
  } else if (token?.amount) {
    rawAmountStr = token.amount;
  }

  let humanAmount: string;
  try {
    humanAmount = formatUnits(BigInt(rawAmountStr), decimals);
  } catch {
    humanAmount = "0";
  }

  const account = accountMap.get(proposal.accountId);
  const accountName = account?.name ?? truncateId(proposal.accountId);
  const tokenLogo = getTokenLogo(tokenAddress, resolvedBech32);

  return {
    id: proposal.uuid,
    date: formatDate(proposal.createdAt),
    timestamp: new Date(proposal.createdAt).getTime(),
    accountName,
    accountId: proposal.accountId,
    recipientId: proposal.recipientId ? truncateId(proposal.recipientId) : undefined,
    type: isOutgoing ? ("outgoing" as const) : ("incoming" as const),
    symbol,
    tokenLogo,
    displayAmount: `${isOutgoing ? "-" : "+"}${formatNumberWithCommas(humanAmount)} ${symbol}`,
    tokenAmount: `${isOutgoing ? "-" : ""}${formatNumberWithCommas(humanAmount)} ${symbol}`,
  };
}

/**
 * Hook to resolve faucet metadata for a list of hex faucet addresses using the Miden SDK.
 * Results are cached in getFaucetMetadata's promise cache, so repeated calls are cheap.
 */
function useResolvedTokenMeta(faucetHexIds: string[]) {
  const { client: webClient } = useMidenProvider();
  const [tokenMetaMap, setTokenMetaMap] = useState<Map<string, TokenMeta>>(new Map());

  const resolve = useCallback(async () => {
    if (!webClient || faucetHexIds.length === 0) return;

    const { AccountId, Address, NetworkId } = await import("@miden-sdk/miden-sdk");
    const newEntries: [string, TokenMeta][] = [];

    await Promise.allSettled(
      faucetHexIds.map(async hexId => {
        const key = hexId.toLowerCase();
        try {
          const meta: FaucetMetadata = await getFaucetMetadata(webClient, hexId);
          const faucetAccountId = AccountId.fromHex(hexId);
          const bech32 = Address.fromAccountId(faucetAccountId).toBech32(NetworkId.testnet());
          newEntries.push([key, { symbol: meta.symbol, decimals: meta.decimals, bech32 }]);
        } catch {
          /* skip — will use fallback */
        }
      }),
    );

    if (newEntries.length > 0) {
      setTokenMetaMap(prev => {
        const next = new Map(prev);
        for (const [k, v] of newEntries) next.set(k, v);
        return next;
      });
    }
  }, [webClient, faucetHexIds]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return tokenMetaMap;
}

const TransactionHistory = () => {
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts } = useListAccountsByCompany(myCompany?.id, { enabled: !!myCompany?.id });
  const accountIds = useMemo(() => multisigAccounts?.map(a => a.accountId) || [], [multisigAccounts]);
  const { data: localBalances } = useLocalAccountBalances(accountIds, { enabled: accountIds.length > 0 });
  const { data: proposals } = useListProposalsByCompany(myCompany?.id, { enabled: !!myCompany?.id });
  const { accountCacheMap } = usePSMProvider();

  // Collect all enriched balances across all cached accounts
  const allEnrichedBalances = useMemo(() => {
    const balances: EnrichedBalance[] = [];
    for (const cache of accountCacheMap.values()) {
      balances.push(...cache.enrichedBalances);
    }
    return balances;
  }, [accountCacheMap]);

  // Collect unique hex faucet IDs from proposals that aren't already resolved by enrichedBalances or supportedTokens
  const unresolvedFaucetIds = useMemo(() => {
    if (!proposals) return [];
    const enrichedSet = new Set(allEnrichedBalances.map(eb => eb.faucetId.toLowerCase()));
    const ids = new Set<string>();
    for (const p of proposals) {
      if (p.status !== "EXECUTED") continue;
      const token = p.tokens?.[0];
      const addr = token?.address || p.faucetId || "";
      if (!addr) continue;
      const addrLower = addr.toLowerCase();
      // Skip if already resolved by enriched balances
      if (enrichedSet.has(addrLower)) continue;
      ids.add(addr);
    }
    return Array.from(ids);
  }, [proposals, allEnrichedBalances]);

  // Resolve faucet metadata from SDK for any unresolved tokens
  const tokenMetaMap = useResolvedTokenMeta(unresolvedFaucetIds);

  // Map accountId → account for quick lookup
  const accountMap = useMemo(() => {
    const m = new Map<string, MultisigAccountResponseDto>();
    for (const acc of multisigAccounts ?? []) {
      m.set(acc.accountId, acc);
    }
    return m;
  }, [multisigAccounts]);

  // Filter executed proposals and convert to rows, sorted by newest first
  const transactions = useMemo(() => {
    if (!proposals) return [];
    return proposals
      .filter(p => p.status === "EXECUTED")
      .map(p => proposalToRow(p, accountMap, allEnrichedBalances, tokenMetaMap))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [proposals, accountMap, allEnrichedBalances, tokenMetaMap]);

  // Derive accounts for pie chart from local balances
  const accounts: Account[] = useMemo(() => {
    if (!multisigAccounts || !localBalances) return [];
    const totalBalance = localBalances.totalBalance;
    return localBalances.accounts.map((acc, index) => {
      const matchingAccount = multisigAccounts.find(msa => msa.accountId === acc.accountId);
      const percentage = totalBalance > 0 ? (acc.balance / totalBalance) * 100 : 0;
      return {
        id: acc.accountId,
        name: matchingAccount?.name || truncateId(acc.accountId, 12),
        percentage: Math.round(percentage),
        balance: `$${acc.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        color: chartColors[index % chartColors.length],
      };
    });
  }, [multisigAccounts, localBalances]);

  return (
    <div className="w-full border border-primary-divider rounded-3xl flex flex-row gap-px overflow-hidden">
      {/* Left side - Transaction History */}
      <div id="tour-money-in-out" className="flex-1 rounded-l-3xl border-r border-primary-divider p-4 flex gap-2 flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-text-primary">Money in & Money out</h3>
          {/* <span className="text-sm text-text-secondary">This year</span> */}
        </div>

        {/* Transactions List */}
        <div className="max-h-100 overflow-y-auto space-y-0 bg-background rounded-2xl">
          {/* Table Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-primary-divider text-xs font-medium text-text-secondary">
            <div className="w-[110px]">Date</div>
            <div className="flex-1">Account</div>
            <div className="flex-1 text-right">Amount</div>
          </div>

          {transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12 h-full">
              <p className="text-sm text-text-secondary h-full">No executed transactions yet</p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              <div
                key={tx.id}
                className={`flex items-center gap-3 px-5 py-4 ${index !== transactions.length - 1 ? "border-b border-primary-divider" : ""}`}
              >
                <div className="w-[110px]">
                  <p className="text-sm text-text-secondary">{tx.date}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{tx.accountName}</p>
                  <p className="text-xs text-text-secondary truncate">
                    {tx.type === "outgoing" && tx.recipientId
                      ? `To: ${tx.recipientId}`
                      : tx.type === "incoming"
                        ? "Consume"
                        : "Send"}
                  </p>
                </div>
                <div className="flex-1 text-right flex flex-col items-end gap-0.5">
                  <p className={`text-sm font-semibold ${tx.type === "incoming" ? "text-green-500" : "text-red-500"}`}>
                    {tx.displayAmount}
                  </p>
                  <div className="flex items-center gap-1">
                    <img src={tx.tokenLogo} alt={tx.symbol} className="w-3.5 h-3.5 rounded-full" />
                    <p className="text-xs text-text-secondary">{tx.tokenAmount}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right side - All Accounts */}
      <div id="tour-multisig" className="flex-1 gap-2 flex flex-col p-4">
        <h3 className="text-base font-medium">All Accounts</h3>

        <div className="w-full flex flex-row bg-background border-t border-primary-divider rounded-2xl h-full justify-center items-center gap-6">
          {accounts.length === 0 ? (
            <div className="flex flex-col gap-3 items-center justify-center w-full h-full py-12">
              <img src="/misc/hexagon-contact-icon.svg" alt="No Multisig Account" className="w-20 h-20" />
              <p className="text-sm font-medium text-text-secondary">
                You need to create a multisig account to access this feature.
              </p>
              <Link
                href="/setting"
                className="bg-text-primary hover:bg-text-primary/90 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
              >
                Create account
              </Link>
            </div>
          ) : (
            <>
              {/* Donut Chart Section */}
              <div className="flex items-center justify-center h-64 flex-1/3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={accounts.map(acc => ({ name: acc.name, value: acc.percentage }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      isAnimationActive={true}
                    >
                      {accounts.map(account => (
                        <Cell key={`cell-${account.id}`} fill={account.color} />
                      ))}
                    </Pie>
                    <Tooltip content={() => null} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Account Items */}
              <div className="space-y-px flex-2/3">
                <div className="flex items-center px-4 py-2 gap-4 border-b border-primary-divider text-text-secondary">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Weight</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Account</p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">Balance</p>
                  </div>
                </div>
                {accounts.map((account, index) => (
                  <div
                    key={account.id}
                    className={`flex items-center px-4 py-3 gap-4 ${index !== accounts.length - 1 ? "border-b border-primary-divider" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: account.color }}></div>
                      <span className="text-sm font-medium">{account.percentage}%</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{account.name}</p>
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium">{account.balance}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;
