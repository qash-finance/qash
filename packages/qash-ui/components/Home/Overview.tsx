import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { BaseContainer } from "../Common/BaseContainer";
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import TransactionHistory from "./Overview/TransactionHistory";
import { useLocalAccountBalances, useListAccountsByCompany, useMultisigAssets } from "@/services/api/multisig";
import { useGetMyCompany } from "@/services/api/company";
import { useMidenProvider } from "@/contexts/MidenProvider";
import { supportedTokens } from "@/services/utils/supportedToken";

// -- Constants --
const ASSET_COLORS: Record<string, string> = {
  QASH: "#066eff",
  PARA: "#00E595",
  MID: "#a855f7",
};
const DEFAULT_ASSET_COLOR = "#6b7280";
const MONTHLY_HISTORY_KEY = "multisig_monthly_history";
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// -- Types --
interface AssetMonthData {
  inflow: number;
  outflow: number;
  endBalance: number;
}

interface MonthlyRecord {
  /** "2026-02" */
  month: string;
  assets: Record<string, AssetMonthData>;
}

interface ChartPoint {
  month: string;
  [key: string]: number | string; // e.g. QASH, PARA, QASH_in, QASH_out
}

// -- Helpers --
function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeHexId(id: string): string {
  const lower = id.toLowerCase();
  return lower.startsWith("0x") ? lower : `0x${lower}`;
}

function loadMonthlyHistory(): MonthlyRecord[] {
  try {
    const raw = localStorage.getItem(MONTHLY_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMonthlyHistory(records: MonthlyRecord[]) {
  try {
    // Keep at most 24 months
    localStorage.setItem(MONTHLY_HISTORY_KEY, JSON.stringify(records.slice(-24)));
  } catch {
    /* quota exceeded */
  }
}

/**
 * Resolve a hex faucet AccountId to { symbol, decimals } using supportedTokens.
 * Uses the same pattern as PSMProvider.enrichAndCache:
 *   convert hex → bech32 via Address.fromAccountId, then match against supportedTokens.
 */
async function resolveFaucet(
  faucetAccountId: any,
  sdkImports: { Address: any; NetworkId: any },
): Promise<{ symbol: string; decimals: number } | null> {
  try {
    const { Address, NetworkId } = sdkImports;
    const bech32 = Address.fromAccountId(faucetAccountId).toBech32(NetworkId.testnet());
    const match = supportedTokens.find(t => bech32.startsWith(t.faucetId.split("_")[0]));
    return match ? { symbol: match.symbol, decimals: match.decimals } : null;
  } catch {
    return null;
  }
}

/**
 * Fetch all multisig transactions from WebClient and compute per-month inflow/outflow per asset.
 */
async function resolveTransactionHistory(
  webClient: any,
  accountIds: string[],
): Promise<Map<string, Record<string, { inflow: number; outflow: number }>>> {
  const { TransactionFilter, NoteFilter, NoteFilterTypes, Address, NetworkId } = await import(
    "@miden-sdk/miden-sdk"
  );

  const allTxs = await webClient.getTransactions(TransactionFilter.all());
  const msSet = new Set(accountIds.map(normalizeHexId));

  const msTxs = allTxs.filter((tx: any) => {
    const hex = normalizeHexId(tx.accountId().toHex());
    return msSet.has(hex);
  });

  if (msTxs.length === 0) return new Map();

  // Get consumed input notes and group by consumer transaction ID
  const consumedNotes = await webClient.getInputNotes(new NoteFilter(NoteFilterTypes.Consumed));
  const notesByTxId = new Map<string, any[]>();
  for (const note of consumedNotes) {
    const txId = note.consumerTransactionId();
    if (txId) {
      const arr = notesByTxId.get(txId) ?? [];
      arr.push(note);
      notesByTxId.set(txId, arr);
    }
  }

  const sdk = { Address, NetworkId };

  // monthKey -> symbol -> { inflow, outflow }
  const result = new Map<string, Record<string, { inflow: number; outflow: number }>>();

  for (const tx of msTxs) {
    const txId = tx.id().toHex();
    const timestamp = Number(tx.creationTimestamp());
    const date = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
    const mk = toMonthKey(date);

    if (!result.has(mk)) result.set(mk, {});
    const monthData = result.get(mk)!;

    const inputNotes = notesByTxId.get(txId);

    if (!inputNotes || inputNotes.length === 0) {
      // Outgoing: extract assets from output notes
      try {
        const outputNotes = tx
          .outputNotes()
          .notes()
          .map((n: any) => n.intoFull());
        for (const note of outputNotes) {
          for (const asset of note.assets().fungibleAssets()) {
            const meta = await resolveFaucet(asset.faucetId(), sdk);
            if (!meta) continue;
            const amount = Number(asset.amount()) / Math.pow(10, meta.decimals);
            if (!monthData[meta.symbol]) monthData[meta.symbol] = { inflow: 0, outflow: 0 };
            monthData[meta.symbol].outflow += amount;
          }
        }
      } catch {
        /* some notes may not be fully resolvable */
      }
    } else {
      // Incoming: extract assets from consumed input notes
      for (const note of inputNotes) {
        try {
          for (const asset of note.details().assets().fungibleAssets()) {
            const meta = await resolveFaucet(asset.faucetId(), sdk);
            if (!meta) continue;
            const amount = Number(asset.amount()) / Math.pow(10, meta.decimals);
            if (!monthData[meta.symbol]) monthData[meta.symbol] = { inflow: 0, outflow: 0 };
            monthData[meta.symbol].inflow += amount;
          }
        } catch {
          /* note details may not be available */
        }
      }
    }
  }

  return result;
}

// -- BalanceOverviewHeader --
const BalanceOverviewHeader = ({
  totalBalance = 0,
  accountIds,
}: {
  totalBalance?: number;
  accountIds?: string[];
}) => {
  const { client: webClient } = useMidenProvider();
  const { data: assetsData } = useMultisigAssets(accountIds);
  const resolvedRef = useRef(false);

  // Current per-asset balances (live from PSM cache)
  const currentBalances = useMemo<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const b of assetsData?.balances ?? []) {
      if (b.symbol !== "UNKNOWN") m[b.symbol] = parseFloat(b.balance) || 0;
    }
    return m;
  }, [assetsData]);

  const symbols = useMemo(() => Object.keys(currentBalances), [currentBalances]);

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [monthlyInOut, setMonthlyInOut] = useState<Map<string, Record<string, { inflow: number; outflow: number }>>>(
    new Map(),
  );

  // Resolve WebClient transactions once per mount (or when accountIds change)
  useEffect(() => {
    if (!webClient || !accountIds?.length) return;
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    let cancelled = false;
    resolveTransactionHistory(webClient, accountIds)
      .then(result => {
        if (!cancelled) {
          setMonthlyInOut(result);
          console.log(`[Overview] Resolved transaction history for ${result.size} month(s)`);
        }
      })
      .catch(err => {
        console.warn("[Overview] Transaction resolution failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [webClient, accountIds]);

  // Build chart data: Jan–Dec of current year
  const buildChart = useCallback(() => {
    if (!symbols.length) return;

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIdx = today.getMonth(); // 0-based
    const currentMk = toMonthKey(today);
    const hasTransactionData = monthlyInOut.size > 0;

    // Load cached monthly records from localStorage
    const history = loadMonthlyHistory();
    const historyMap = new Map(history.map(r => [r.month, r]));

    // Save current month with live balances
    historyMap.set(currentMk, {
      month: currentMk,
      assets: Object.fromEntries(
        symbols.map(s => {
          const io = monthlyInOut.get(currentMk)?.[s] ?? { inflow: 0, outflow: 0 };
          return [s, { inflow: io.inflow, outflow: io.outflow, endBalance: currentBalances[s] ?? 0 }];
        }),
      ),
    });

    // Generate Jan (index 0) through Dec (index 11) keys for the current year
    const monthKeys = Array.from({ length: 12 }, (_, m) => toMonthKey(new Date(currentYear, m, 1)));

    // Determine per-month balances
    const balanceByMonth = new Map<string, Record<string, number>>();

    if (hasTransactionData) {
      // Backward reconstruction from current live balance using real inflow/outflow
      const running: Record<string, number> = { ...currentBalances };
      for (let m = currentMonthIdx; m >= 0; m--) {
        const mk = monthKeys[m];
        balanceByMonth.set(mk, { ...running });
        if (m > 0) {
          const io = monthlyInOut.get(mk) ?? {};
          for (const s of symbols) {
            const { inflow = 0, outflow = 0 } = io[s] ?? {};
            running[s] = Math.max(0, (running[s] ?? 0) - inflow + outflow);
          }
        }
      }
    } else {
      // No transaction data — only use saved localStorage history (no backfilling)
      for (const [mk, record] of historyMap) {
        const balances: Record<string, number> = {};
        for (const s of symbols) {
          balances[s] = record.assets[s]?.endBalance ?? 0;
        }
        balanceByMonth.set(mk, balances);
      }
    }

    // Build chart points for Jan–Dec
    const points: ChartPoint[] = monthKeys.map((mk, idx) => {
      const point: ChartPoint = { month: MONTH_NAMES[idx] };
      const io = monthlyInOut.get(mk) ?? {};

      if (idx > currentMonthIdx) {
        // Future months: no data yet
        for (const s of symbols) {
          point[s] = 0;
          point[`${s}_in`] = 0;
          point[`${s}_out`] = 0;
        }
      } else {
        const balances = balanceByMonth.get(mk);
        for (const s of symbols) {
          point[s] = balances?.[s] ?? 0;
          point[`${s}_in`] = io[s]?.inflow ?? 0;
          point[`${s}_out`] = io[s]?.outflow ?? 0;
        }
      }

      return point;
    });

    setChartData(points);
    saveMonthlyHistory(Array.from(historyMap.values()));
  }, [symbols, currentBalances, monthlyInOut]);

  useEffect(() => {
    buildChart();
  }, [buildChart]);

  // Compute balance change: current month vs previous month (by index in Jan–Dec array)
  const balanceChange = useMemo(() => {
    if (!symbols.length) return { amount: 0, percent: 0 };
    const currentMonthIdx = new Date().getMonth();
    if (currentMonthIdx === 0 || !chartData[currentMonthIdx]) return { amount: 0, percent: 0 };

    const curr = chartData[currentMonthIdx];
    const prev = chartData[currentMonthIdx - 1];
    let prevTotal = 0;
    let currTotal = 0;
    for (const s of symbols) {
      prevTotal += (prev?.[s] as number) || 0;
      currTotal += (curr?.[s] as number) || 0;
    }
    const amount = currTotal - prevTotal;
    const percent = prevTotal > 0 ? (amount / prevTotal) * 100 : 0;
    return { amount, percent };
  }, [chartData, symbols]);

  // Compute current month totals for inflow/outflow
  const currentMonthFlow = useMemo(() => {
    if (!symbols.length) return { inflow: 0, outflow: 0 };
    const curr = chartData[new Date().getMonth()];
    if (!curr) return { inflow: 0, outflow: 0 };
    let inflow = 0;
    let outflow = 0;
    for (const s of symbols) {
      inflow += (curr[`${s}_in`] as number) || 0;
      outflow += (curr[`${s}_out`] as number) || 0;
    }
    return { inflow, outflow };
  }, [chartData, symbols]);

  const isPositiveChange = balanceChange.amount >= 0;

  // Tooltip showing per-asset balance + inflow/outflow
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const dataPoint = payload[0]?.payload;
    if (!dataPoint) return null;

    return (
      <div className="rounded-lg p-3 border border-primary-divider backdrop-blur-sm bg-background min-w-[140px]">
        <div className="text-text-secondary text-xs mb-2">{dataPoint.month}</div>
        <div className="flex flex-col gap-1.5">
          {payload
            .filter((entry: any) => !entry.dataKey.includes("_"))
            .map((entry: any, i: number) => {
              const sym = entry.dataKey;
              const inVal = (dataPoint[`${sym}_in`] as number) || 0;
              const outVal = (dataPoint[`${sym}_out`] as number) || 0;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-text-primary font-medium">
                      {Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-text-secondary text-xs">{sym}</span>
                  </div>
                  {(inVal > 0 || outVal > 0) && (
                    <div className="flex gap-2 ml-4 text-xs">
                      {inVal > 0 && (
                        <span className="text-green-500">+{inVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      )}
                      {outVal > 0 && (
                        <span className="text-red-500">-{outVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <div id="tour-balance-overview" className="w-full p-5 bg-background rounded-2xl border border-primary-divider flex flex-row py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">Total Balance</p>
          <div className="flex items-start gap-1">
            <span className="text-3xl font-medium text-text-primary">$</span>
            <span className="text-4xl font-bold text-text-primary tracking-tight">
              {totalBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isPositiveChange ? "text-green-500" : "text-red-500"}`}>
              {isPositiveChange ? "+" : ""}$
              {Math.abs(balanceChange.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            {balanceChange.percent !== 0 && (
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                  isPositiveChange
                    ? "text-green-700 bg-green-100 border-green-300"
                    : "text-red-700 bg-red-100 border-red-300"
                }`}
              >
                {isPositiveChange ? "+" : ""}
                {balanceChange.percent.toFixed(2)}%
              </span>
            )}
          </div>
          {/* Monthly flow summary */}
          {(currentMonthFlow.inflow > 0 || currentMonthFlow.outflow > 0) && (
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              {currentMonthFlow.inflow > 0 && (
                <span className="text-green-500">
                  In: +${currentMonthFlow.inflow.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              )}
              {currentMonthFlow.outflow > 0 && (
                <span className="text-red-500">
                  Out: -${currentMonthFlow.outflow.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          )}
          {/* Asset legend */}
          {symbols.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              {symbols.map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ASSET_COLORS[s] ?? DEFAULT_ASSET_COLOR }}
                  />
                  <span className="text-xs text-text-secondary">{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3">
        {/* Multi-asset Line Chart */}
        <ResponsiveContainer width="100%" height="100%" className="rounded-xl">
          <LineChart data={chartData} className="!outline-none p-2">
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickMargin={0}
              interval={0}
            />
            <Tooltip content={<CustomTooltip />} />
            {symbols.map(s => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={ASSET_COLORS[s] ?? DEFAULT_ASSET_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: ASSET_COLORS[s] ?? DEFAULT_ASSET_COLOR,
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const Overview = () => {
  const { data: myCompany } = useGetMyCompany();
  const { data: multisigAccounts } = useListAccountsByCompany(myCompany?.id, { enabled: !!myCompany?.id });

  const accountIds = multisigAccounts?.map(acc => acc.accountId);
  const { data: balanceData } = useLocalAccountBalances(accountIds);
  const totalBalance = balanceData?.totalBalance ?? 0;

  return (
    <div className="w-full">
      <BaseContainer
        header={
          <div className="flex flex-col w-full p-5 gap-4">
            <span className="text-text-primary text-2xl leading-none text-left w-full">Overview</span>
            <BalanceOverviewHeader totalBalance={totalBalance} accountIds={accountIds} />
          </div>
        }
        childrenClassName="px-3 py-5"
      >
        <div className="flex flex-row h-full items-start w-full border border-primary-divider rounded-3xl">
          <TransactionHistory />
        </div>
      </BaseContainer>
    </div>
  );
};
