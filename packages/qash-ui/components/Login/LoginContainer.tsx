"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { debounce, DebouncedFunc } from "lodash";
import LoginButton from "./LoginButton";
import Welcome from "../Common/Welcome";
import InputOutlined from "../Common/Input/InputOutlined";
import { useAuth } from "@/services/auth/context";
import toast from "react-hot-toast";
import { User } from "@/types/user";
import { useModal as useParaModal, useWallet, useClient, useAccount as useParaAccount } from "@getpara/react-sdk-lite";
import { PrimaryButton } from "../Common/PrimaryButton";
import { trackEvent } from "@/services/analytics/posthog";
import { PostHogEvent } from "@/types/posthog";

type Step = "email" | "otp";

type EmailForm = {
  email: string;
};

export default function LoginContainer() {
  const router = useRouter();
  const { loginWithPara, isLoading, error, isAuthenticated, user, refreshUser } = useAuth();
  const [authenticatingWithPara, setAuthenticatingWithPara] = useState(false);
  const { openModal: openParaModal } = useParaModal();
  const para = useClient();
  const { isConnected } = useParaAccount();
  const { data: wallet } = useWallet();
  const isAuthenticatingRef = useRef(false);

  // Handle Para authentication after connection
  const handleParaAuthentication = async () => {
    // Prevent duplicate authentication attempts
    if (isAuthenticatingRef.current) {
      return;
    }

    if (!isConnected || !para) {
      toast.error("Please connect your wallet first");
      return;
    }

    isAuthenticatingRef.current = true;
    setAuthenticatingWithPara(true);
    try {
      // Issue JWT from Para
      const jwtResult = await para.issueJwt();

      if (!jwtResult?.token) {
        throw new Error("Failed to get JWT token from Para");
      }

      console.log("Para JWT issued:", { keyId: jwtResult.keyId });

      // Extract wallet public key from JWT payload (same source as useParaSigner)
      // This ensures the commitment stored in DB matches what ParaSigner will derive
      // when authenticating to PSM — prevents 401 mismatch for cosigners.
      const jwtPayload = JSON.parse(window.atob(jwtResult.token.split(".")[1]));
      const connectedWallets = jwtPayload.data?.connectedWallets || [];
      const evmWallet = connectedWallets.find((w: any) => w.type === "EVM");
      const publicKey = evmWallet?.publicKey || wallet?.publicKey;

      if (!publicKey) {
        console.error("Wallet public key is missing from both JWT and wallet state");
        return;
      }

      console.log("[Login] Public key source:", {
        fromJwt: !!evmWallet?.publicKey,
        fromWallet: !!wallet?.publicKey,
        match: evmWallet?.publicKey === wallet?.publicKey,
        publicKey: publicKey.slice(0, 40) + "...",
      });

      // Derive ECDSA commitment from wallet public key for multisig support
      let commitment: string | undefined;
      try {
        const { tryComputeEcdsaCommitmentHex, EcdsaFormat } = await import("@openzeppelin/miden-multisig-client");
        const compressedPk = EcdsaFormat.compressPublicKey(publicKey);
        commitment = tryComputeEcdsaCommitmentHex(compressedPk) ?? undefined;
        console.log("[Login] Derived commitment:", commitment);
      } catch (err) {
        console.warn("Failed to derive ECDSA commitment:", err);
      }

      // Send JWT, publicKey and commitment to backend
      const userData = await loginWithPara(jwtResult.token, publicKey, commitment);

      toast.success("Successfully authenticated");
      trackEvent(PostHogEvent.USER_LOGGED_IN, { method: "para" });

      await refreshUser();

      // Determine destination based on user data
      const hasCompany = !!userData?.teamMembership?.companyId || !!userData?.teamMembership?.company;

      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 500));

      router.push(hasCompany ? "/" : "/onboarding");
    } catch (error) {
      console.error("Para authentication failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to authenticate");
    } finally {
      isAuthenticatingRef.current = false;
      setAuthenticatingWithPara(false);
    }
  };

  // Auto-authenticate when Para connection is established
  useEffect(() => {
    if (isConnected && !isAuthenticated && !authenticatingWithPara && !isAuthenticatingRef.current) {
      handleParaAuthentication();
    }
  }, [isConnected, isAuthenticated, authenticatingWithPara]);

  // Redirect authenticated users away from login
  useEffect(() => {
    if (!isAuthenticated) return;
    const hasCompany = !!(user as User)?.teamMembership?.companyId;
    const destination = hasCompany ? "/" : "/onboarding";

    router.push(destination);
  }, [isAuthenticated, user, router]);

  return (
    <div className="flex flex-col-reverse lg:flex-row w-full h-full p-3 md:p-5 bg-background overflow-hidden">
      <div className="hidden lg:block lg:w-1/2 h-full">
        <Welcome />
      </div>

      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 h-full px-4 md:px-8 lg:px-20 xl:px-50 relative">
        <div className="flex flex-col w-full max-w-md items-center justify-center mb-8 md:mb-10">
          <img src="/logo/qash-icon.svg" alt="logo" className="w-12 md:w-15" />
          <p className="font-barlow font-medium text-[24px] md:text-[32px] text-text-primary text-center w-full">
            Get started now
          </p>
          <p className="font-barlow font-medium text-[14px] md:text-[16px] text-text-secondary text-center w-full">
            Welcome to Qash - Let get started
          </p>
        </div>

        <PrimaryButton
          onClick={() => {
            openParaModal?.();
          }}
          text={authenticatingWithPara ? "Authenticating..." : "Continue by email"}
          disabled={authenticatingWithPara || isLoading || isAuthenticated}
          containerClassName="w-full max-w-md"
        />
      </div>
    </div>
  );
}
