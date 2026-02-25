"use client";

import { useState } from "react";
import { NODE_ENDPOINT } from "@/services/utils/constant";

export default function DeployFaucetPage() {
  const [symbol, setSymbol] = useState("QASH");
  const [decimals, setDecimals] = useState(8);
  const [maxSupply, setMaxSupply] = useState(1000000000000000000);
  const [result, setResult] = useState<string | null>(null);
  const [accountFileHex, setAccountFileHex] = useState<string | null>(null);
  const [secretKeyHex, setSecretKeyHex] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDeploy = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus("");

    try {
      const { AccountStorageMode, WebClient, NoteType, NetworkId, AccountInterface } = await import("@miden-sdk/miden-sdk");

      // Create a standalone WebClient (not Para-backed)
      setStatus("Creating WebClient...");
      const client = await WebClient.createClient(NODE_ENDPOINT);

      // 1. Deploy the faucet
      setStatus("Deploying faucet...");
      const faucet = await client.newFaucet(AccountStorageMode.public(), false, symbol, decimals, BigInt(maxSupply), 1);
      const faucetBech32 = faucet.id().toBech32(NetworkId.testnet(), AccountInterface.BasicWallet);
      console.log("[DeployFaucet] Faucet created locally:", faucetBech32);

      // 2. Deploy a temporary wallet to receive the initial mint
      setStatus("Deploying temporary wallet...");
      const wallet = await client.newWallet(AccountStorageMode.public(), true, 1);
      console.log("[DeployFaucet] Temp wallet created:", wallet.id().toString());

      // 3. Mint a small amount to the temp wallet — this publishes the faucet on-chain
      setStatus("Minting initial tokens to publish faucet on-chain...");
      await client.syncState();
      const mintTxRequest = client.newMintTransactionRequest(
        wallet.id(),
        faucet.id(),
        NoteType.Public,
        BigInt(1), // mint 1 raw unit just to publish
      );
      await client.submitNewTransaction(faucet.id(), mintTxRequest);
      console.log("[DeployFaucet] Initial mint tx submitted, faucet is now on-chain");

      // 4. Export faucet account file (includes private keys) for sharing with other clients
      setStatus("Exporting faucet account file...");
      const accountFile = await client.exportAccountFile(faucet.id());
      const serialized = accountFile.serialize();
      const hex = Array.from(serialized).map(b => b.toString(16).padStart(2, "0")).join("");
      setAccountFileHex(hex);
      console.log("[DeployFaucet] Faucet account file exported, length:", hex.length);

      // 5. Export just the auth secret key (for use with addAccountSecretKeyToWebStore)
      setStatus("Exporting faucet secret key...");
      const commitments = await client.getPublicKeyCommitmentsOfAccount(faucet.id());
      if (commitments.length > 0) {
        const authKey = await client.getAccountAuthByPubKeyCommitment(commitments[0]);
        const keyBytes = authKey.serialize();
        const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, "0")).join("");
        setSecretKeyHex(keyHex);
        console.log("[DeployFaucet] Faucet secret key exported, length:", keyHex.length);
      }

      setResult(faucetBech32);
      setStatus("Done! Faucet deployed and published on-chain.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("");
      console.error("[DeployFaucet] Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, maxWidth: 600, fontFamily: "monospace" }}>
      <h1>Deploy Faucet (Dev)</h1>

      <div style={{ marginBottom: 16 }}>
        <label>Symbol: </label>
        <input value={symbol} onChange={e => setSymbol(e.target.value)} style={{ padding: 4, marginLeft: 8 }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>Decimals: </label>
        <input
          type="number"
          value={decimals}
          onChange={e => setDecimals(Number(e.target.value))}
          style={{ padding: 4, marginLeft: 8 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>Max Supply: </label>
        <input
          type="number"
          value={maxSupply}
          onChange={e => setMaxSupply(Number(e.target.value))}
          style={{ padding: 4, marginLeft: 8 }}
        />
      </div>

      <button
        onClick={handleDeploy}
        disabled={loading}
        style={{
          padding: "8px 24px",
          cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "#ccc" : "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          fontSize: 16,
        }}
      >
        {loading ? "Deploying..." : "Deploy Faucet"}
      </button>

      {status && <p style={{ color: "#666", marginTop: 12 }}>{status}</p>}

      {error && <p style={{ color: "red", marginTop: 12 }}>Error: {error}</p>}

      {result && (
        <div style={{ marginTop: 20, padding: 16, background: "#f0f0f0", borderRadius: 4 }}>
          <p style={{ fontWeight: "bold" }}>Faucet Address (bech32):</p>
          <code
            style={{ wordBreak: "break-all", cursor: "pointer", display: "block", marginTop: 8 }}
            onClick={() => {
              navigator.clipboard.writeText(result);
              alert("Copied!");
            }}
          >
            {result}
          </code>
          <p style={{ fontSize: 12, marginTop: 8, color: "#666" }}>
            Click to copy. Paste this into QASH_TOKEN_ADDRESS in constant.ts
          </p>
        </div>
      )}

      {secretKeyHex && (
        <div style={{ marginTop: 20, padding: 16, background: "#d4edda", borderRadius: 4 }}>
          <p style={{ fontWeight: "bold" }}>Faucet Auth Secret Key:</p>
          <code
            style={{ wordBreak: "break-all", cursor: "pointer", display: "block", marginTop: 8, fontSize: 10, maxHeight: 120, overflow: "auto" }}
            onClick={() => {
              navigator.clipboard.writeText(secretKeyHex);
              alert("Copied!");
            }}
          >
            {secretKeyHex}
          </code>
          <p style={{ fontSize: 12, marginTop: 8, color: "#666" }}>
            Click to copy. Paste this into NEXT_PUBLIC_FAUCET_SECRET_KEY in .env
          </p>
        </div>
      )}

      {accountFileHex && (
        <div style={{ marginTop: 20, padding: 16, background: "#fff3cd", borderRadius: 4 }}>
          <p style={{ fontWeight: "bold" }}>Faucet Account File (backup):</p>
          <code
            style={{ wordBreak: "break-all", cursor: "pointer", display: "block", marginTop: 8, fontSize: 10, maxHeight: 120, overflow: "auto" }}
            onClick={() => {
              navigator.clipboard.writeText(accountFileHex);
              alert("Copied!");
            }}
          >
            {accountFileHex}
          </code>
          <p style={{ fontSize: 12, marginTop: 8, color: "#666" }}>
            Click to copy (full account file backup, includes private key + state snapshot)
          </p>
        </div>
      )}
    </div>
  );
}
