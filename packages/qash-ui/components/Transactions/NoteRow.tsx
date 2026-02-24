"use client";
import React from "react";
import { formatUnits } from "viem";
import { formatAddress } from "@/services/utils/miden/address";
import type { ConsumableNote } from "@/services/api/multisig";
import { QASH_TOKEN_ADDRESS, QASH_TOKEN_HEX_ADDRESS, QASH_TOKEN_SYMBOL, QASH_TOKEN_DECIMALS } from "@/services/utils/constant";
import { supportedTokens } from "@/services/utils/supportedToken";
import { PrimaryButton } from "../Common/PrimaryButton";

interface NoteRowProps {
  note: ConsumableNote;
  selected?: boolean;
  onSelect?: (noteId: string) => void;
  onClaimNote?: (noteId: string) => Promise<void>;
  isLoading?: boolean;
  isInProposal?: boolean;
  isViewer?: boolean;
}

// Helper to check if a hex faucet ID matches the QASH token
function isQashHexAddress(hexId: string): boolean {
  return hexId.toLowerCase().replace(/^0x/, "") === QASH_TOKEN_HEX_ADDRESS.toLowerCase().replace(/^0x/, "");
}

// Helper to get a token logo path by bech32 faucet ID, hex faucet ID, or symbol
function getTokenLogo(faucetBech32: string, faucetHex: string, symbol: string): string {
  // Match QASH token by hex address
  if (faucetHex && isQashHexAddress(faucetHex)) {
    return "/token/qash.svg";
  }
  // Match QASH token by bech32 (may have a _suffix like _qruqqypuyph)
  if (faucetBech32 && QASH_TOKEN_ADDRESS.startsWith(faucetBech32.split("_")[0])) {
    return "/token/qash.svg";
  }
  // Check other supported tokens
  const known = supportedTokens.find(t => {
    const base = t.faucetId.split("_")[0];
    return faucetBech32 && faucetBech32.startsWith(base);
  });
  if (known) {
    const sym = known.symbol.toLowerCase();
    return `/token/${sym}.svg`;
  }
  // Fallback by symbol
  if (symbol.toUpperCase() === "QASH") return "/token/qash.svg";
  return "/token/any-token.svg";
}

// Format amount with given decimals
function formatAmount(amount: number | string, decimals: number): string {
  try {
    const bigIntAmount = BigInt(Math.round(Number(amount)));
    return formatUnits(bigIntAmount, decimals);
  } catch {
    return "0";
  }
}

// Helper function to parse note_type (e.g., "Some(Public)" -> "Public")
function parseNoteType(noteType: string): string {
  if (!noteType) return "";
  const match = noteType.match(/Some\((\w+)\)/);
  return match ? match[1] : noteType;
}

// Helper function to get note type color
function getNoteTypeBadgeColor(noteType: string): string {
  const type = parseNoteType(noteType).toLowerCase();
  if (type.includes("public")) return "bg-purple-50 border-purple-200 text-purple-700";
  if (type.includes("private")) return "bg-blue-50 border-blue-200 text-blue-700";
  return "bg-gray-50 border-gray-200 text-gray-700";
}

export function NoteRow({
  note,
  selected: _selected = false,
  onSelect,
  onClaimNote,
  isLoading = false,
  isInProposal = false,
  isViewer = false,
}: NoteRowProps) {
  const firstAsset = note.assets?.[0];
  const faucetBech32 = firstAsset?.faucet_bech32 || "";
  const faucetHex = firstAsset?.faucet_id || "";
  const isQashToken = isQashHexAddress(faucetHex) || firstAsset?.symbol?.toUpperCase() === "QASH";
  const symbol = isQashToken ? QASH_TOKEN_SYMBOL : (firstAsset?.symbol || "");
  const decimals = isQashToken ? QASH_TOKEN_DECIMALS : (firstAsset?.decimals ?? 8);
  const displayAmount = firstAsset ? formatAmount(firstAsset.amount, decimals) : "0";
  const tokenLabel = symbol || (faucetBech32 ? formatAddress(faucetBech32) : formatAddress(faucetHex));
  const tokenLogo = firstAsset ? getTokenLogo(faucetBech32, faucetHex, symbol) : "/token/any-token.svg";

  const noteTypeFormatted = parseNoteType(note.note_type);
  const noteTypeBadgeColor = getNoteTypeBadgeColor(note.note_type);

  const handleClaimClick = async () => {
    if (onClaimNote) {
      await onClaimNote(note.note_id);
    } else {
      onSelect?.(note.note_id);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 rounded-lg border-b border-primary-divider last:border-b-0 hover:bg-app-background">
      {/* Note ID */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-secondary">ID</span>
        <span className="text-sm font-medium text-text-strong-950">
          {note.note_id.slice(0, 5)}...{note.note_id.slice(-6)}
        </span>
      </div>

      {/* Sender */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-secondary">From</span>
        <span className="text-sm font-medium text-text-strong-950">
          {note.sender ? formatAddress(note.sender) : symbol ? `${symbol} Faucet` : "Unknown"}
        </span>
      </div>

      {/* Asset Info (First asset with amount) */}
      <div className="flex items-center justify-center">
        <img
          src={tokenLogo}
          alt={tokenLabel}
          className="w-6 h-6 mr-2"
          onError={(e) => { (e.target as HTMLImageElement).src = "/token/any-token.svg"; }}
        />
        <span className="text-sm font-medium text-text-strong-950">
          {displayAmount} {tokenLabel}
        </span>
      </div>

      {/* Note Type Badge */}
      <div className="flex items-center justify-center">
        {noteTypeFormatted ? (
          <div className={`inline-flex items-center px-3 py-1 rounded-full border ${noteTypeBadgeColor}`}>
            <span className="text-sm font-semibold">{noteTypeFormatted}</span>
          </div>
        ) : (
          <div className="inline-flex items-center px-3 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-500">
            <span className="text-sm font-semibold">Note</span>
          </div>
        )}
      </div>

      {/* Claim Note Button */}
      <div className="flex items-center justify-end">
        <PrimaryButton
          text={isInProposal ? "In Proposal" : "Claim"}
          onClick={handleClaimClick}
          loading={isLoading}
          disabled={isInProposal || isLoading || isViewer}
          buttonClassName="px-3"
        />
      </div>
    </div>
  );
}
