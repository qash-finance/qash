"use client";
import React from "react";
import { formatUnits } from "viem";
import { formatAddress } from "@/services/utils/miden/address";
import type { ConsumableNote } from "@/services/api/multisig";
import { QASH_TOKEN_ADDRESS } from "@/services/utils/constant";
import { PrimaryButton } from "../Common/PrimaryButton";

interface NoteRowProps {
  note: ConsumableNote;
  selected?: boolean;
  onSelect?: (noteId: string) => void;
  onClaimNote?: (noteId: string) => Promise<void>;
  isLoading?: boolean;
  isInProposal?: boolean;
}

// Helper function to parse note_type (e.g., "Some(Public)" -> "Public")
function parseNoteType(noteType: string): string {
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

// Format amount with 8 decimals
function formatAmount(amount: number | string): string {
  try {
    const bigIntAmount = BigInt(Math.round(Number(amount)));
    return formatUnits(bigIntAmount, 8);
  } catch {
    return "0";
  }
}

export function NoteRow({
  note,
  selected = false,
  onSelect,
  onClaimNote,
  isLoading = false,
  isInProposal = false,
}: NoteRowProps) {
  const firstAsset = note.assets?.[0];
  const displayAmount = firstAsset ? formatAmount(firstAsset.amount) : "0";
  const faucetId = firstAsset?.faucet_id || "";
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
      {/* Checkbox */}
      {/* <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect?.(note.note_id)}
          disabled={isLoading}
          className="w-5 h-5 rounded cursor-pointer"
        />
      </div> */}

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
        <span className="text-sm font-medium text-text-strong-950">{formatAddress(note.sender)}</span>
      </div>

      {/* Asset Info (First asset with amount) */}
      <div className="flex items-center justify-center">
        <img
          src={QASH_TOKEN_ADDRESS.startsWith(faucetId) ? "/token/qash.svg" : "/tokens/unknown-token.svg"}
          alt="Token"
          className="w-6 h-6 mr-2"
        />
        <span className="text-sm font-medium text-text-strong-950">
          {displayAmount} {QASH_TOKEN_ADDRESS.startsWith(faucetId) ? "QASH" : formatAddress(faucetId)}
        </span>
      </div>

      {/* Note Type Badge */}
      <div className="flex items-center justify-center">
        <div className={`inline-flex items-center px-3 py-1 rounded-full border ${noteTypeBadgeColor}`}>
          <span className="text-sm font-semibold">{noteTypeFormatted}</span>
        </div>
      </div>

      {/* Claim Note Button */}
      <div className="flex items-center justify-end">
        <PrimaryButton
          text={isInProposal ? "In Proposal" : "Claim"}
          onClick={handleClaimClick}
          loading={isLoading}
          disabled={isInProposal || isLoading}
          buttonClassName="px-3"
        />
      </div>
    </div>
  );
}
