"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParaMiden } from "@miden-sdk/use-miden-para-react";
import { tryComputeEcdsaCommitmentHex, EcdsaFormat } from "@openzeppelin/miden-multisig-client";
import { NODE_ENDPOINT } from "@/services/utils/constant";

interface WalletWithPublicKey {
  id: string;
  publicKey?: string;
}

export interface ParaSessionState {
  connected: boolean;
  publicKey: string | null;
  commitment: string | null;
}

async function getUncompressedPublicKeyFromWallet(
  para: { issueJwt(): Promise<{ token: string }> },
  wallet: WalletWithPublicKey,
): Promise<string> {
  let publicKey = wallet.publicKey;
  if (!publicKey) {
    const { token } = await para.issueJwt();
    const payload = JSON.parse(window.atob(token.split(".")[1]));
    if (!payload.data) {
      throw new Error("Got invalid jwt token");
    }
    const wallets: Array<{ id: string; publicKey: string }> = payload.data.connectedWallets;
    const w = wallets.find(w => w.id === wallet.id);
    if (!w) {
      throw new Error("Wallet Not Found in jwt data");
    }
    publicKey = w.publicKey;
  }
  return publicKey;
}

export function useParaSession() {
  const [session, setSession] = useState<ParaSessionState>({
    connected: false,
    publicKey: null,
    commitment: null,
  });

  const paraMiden = useParaMiden(NODE_ENDPOINT, "public", {}, false);
  const derivingRef = useRef(false);

  const { para: paraClient, evmWallets } = paraMiden;

  useEffect(() => {
    if (!evmWallets?.length) {
      setSession(prev => ({ ...prev, connected: false, publicKey: null, commitment: null }));
      return;
    }

    const evmWallet = evmWallets[0];
    if (!paraClient || derivingRef.current) return;

    derivingRef.current = true;
    (async () => {
      try {
        const uncompressedPk = await getUncompressedPublicKeyFromWallet(paraClient, evmWallet);
        const compressedPk = EcdsaFormat.compressPublicKey(uncompressedPk);
        const commitmentHex = tryComputeEcdsaCommitmentHex(compressedPk);
        if (!commitmentHex) {
          throw new Error("Failed to derive ECDSA commitment from public key");
        }

        setSession({
          connected: true,
          publicKey: uncompressedPk,
          commitment: commitmentHex,
        });
      } catch {
        setSession(prev => ({ ...prev, connected: false }));
      } finally {
        derivingRef.current = false;
      }
    })();
  }, [evmWallets, paraClient]);

  const getWalletId = useCallback((): string | null => {
    return evmWallets?.[0]?.id ?? null;
  }, [evmWallets]);

  return {
    session,
    paraClient,
    paraMiden,
    getWalletId,
  };
}
