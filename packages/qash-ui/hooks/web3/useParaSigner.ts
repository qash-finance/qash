"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useClient, useAccount, useWallet } from "@getpara/react-sdk-lite";

interface ParaSignerState {
  commitment: string | null;
  publicKey: string | null;
  walletId: string | null;
  isReady: boolean;
}

/**
 * Hook that derives ECDSA commitment + public key from the connected Para wallet
 * and provides a createSigner() function to build a ParaSigner for the MultisigClient.
 *
 * Reference: private-state-manager/examples/web/src/App.tsx (buildExternalParams + createSigner)
 */
export function useParaSigner() {
  const paraClient = useClient();
  const { isConnected, embedded } = useAccount();
  const { data: wallet } = useWallet();

  const [state, setState] = useState<ParaSignerState>({
    commitment: null,
    publicKey: null,
    walletId: null,
    isReady: false,
  });
  const derivingRef = useRef(false);

  const evmWallets = useMemo(() => embedded.wallets?.filter(w => w.type === "EVM"), [embedded.wallets]);

  // Derive commitment + publicKey when the Para wallet connects
  useEffect(() => {
    if (!isConnected || !evmWallets?.length || !paraClient || derivingRef.current) {
      if (!isConnected) setState({ commitment: null, publicKey: null, walletId: null, isReady: false });
      return;
    }

    const evmWallet = evmWallets[0];
    derivingRef.current = true;

    (async () => {
      try {
        const { EcdsaFormat, tryComputeEcdsaCommitmentHex } = await import("@openzeppelin/miden-multisig-client");

        // Get uncompressed public key from Para JWT
        const { token } = await (paraClient as any).issueJwt();
        const payload = JSON.parse(window.atob(token.split(".")[1]));
        const w = payload.data?.connectedWallets?.find((w: any) => w.id === evmWallet.id);
        if (!w?.publicKey) throw new Error("Wallet public key not found in JWT data");
        const publicKey = w.publicKey;

        const compressedPk = EcdsaFormat.compressPublicKey(publicKey);
        const commitment = tryComputeEcdsaCommitmentHex(compressedPk);
        if (!commitment) throw new Error("Failed to derive ECDSA commitment");

        console.log("[useParaSigner] Derived signer info:", {
          walletId: evmWallet.id,
          publicKey: publicKey.slice(0, 40) + "...",
          compressedPk: compressedPk.slice(0, 40) + "...",
          commitment,
        });

        setState({ commitment, publicKey, walletId: evmWallet.id, isReady: true });
      } catch (err) {
        console.error("[useParaSigner] Failed to derive signer info:", err);
        setState({ commitment: null, publicKey: null, walletId: null, isReady: false });
      } finally {
        derivingRef.current = false;
      }
    })();
  }, [isConnected, evmWallets, paraClient]);

  /**
   * Creates a ParaSigner instance for use with MultisigClient.load() / Multisig operations.
   * Must only be called when isReady === true.
   */
  const createSigner = useCallback(async () => {
    if (!state.isReady || !state.commitment || !state.publicKey || !state.walletId || !paraClient) {
      throw new Error("Para signer not ready");
    }

    const { ParaSigner } = await import("@openzeppelin/miden-multisig-client");
    return new ParaSigner(paraClient as any, state.walletId, state.commitment, state.publicKey);
  }, [state, paraClient]);

  return {
    ...state,
    paraClient,
    wallet,
    createSigner,
  };
}
