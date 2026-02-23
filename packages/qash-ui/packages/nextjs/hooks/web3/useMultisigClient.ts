"use client";

import { useState, useEffect, useRef } from "react";
import { PSM_ENDPOINT } from "@/services/utils/constant";
import type { MultisigClient, SignatureScheme } from "@openzeppelin/miden-multisig-client";
import type { WebClient } from "@miden-sdk/miden-sdk";

interface MultisigClientState {
  client: MultisigClient | null;
  psmCommitment: string;
  psmPublicKey: string | undefined;
  isInitializing: boolean;
  error: string | null;
}

/**
 * Hook to initialize the OZ MultisigClient.
 * Requires a WebClient instance (from MidenProvider).
 */
export function useMultisigClient(webClient: WebClient | null, scheme?: SignatureScheme) {
  const [state, setState] = useState<MultisigClientState>({
    client: null,
    psmCommitment: "",
    psmPublicKey: undefined,
    isInitializing: false,
    error: null,
  });
  const initRef = useRef(false);

  useEffect(() => {
    if (!webClient || initRef.current) return;

    initRef.current = true;
    setState(prev => ({ ...prev, isInitializing: true, error: null }));

    (async () => {
      try {
        const { MultisigClient: MultisigClientClass } = await import("@openzeppelin/miden-multisig-client");
        const client = new MultisigClientClass(webClient, { psmEndpoint: PSM_ENDPOINT });
        const { psmCommitment, psmPublicKey } = await client.initialize(scheme);

        setState({
          client,
          psmCommitment,
          psmPublicKey,
          isInitializing: false,
          error: null,
        });
      } catch (err) {
        console.error("Failed to initialize MultisigClient:", err);
        initRef.current = false;
        setState(prev => ({
          ...prev,
          isInitializing: false,
          error: err instanceof Error ? err.message : "Failed to initialize MultisigClient",
        }));
      }
    })();
  }, [webClient, scheme]);

  return state;
}
