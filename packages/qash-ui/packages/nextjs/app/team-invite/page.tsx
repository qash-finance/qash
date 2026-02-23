"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrimaryButton } from "@/components/Common/PrimaryButton";
import { useAcceptInvitationByToken } from "@/services/api/team-member";
import { useAuth } from "@/services/auth/context";
import { useModal, useWallet } from "@getpara/react-sdk";
import toast from "react-hot-toast";
import { useAccount as useParaAccount } from "@getpara/react-sdk";
import { useParaMiden } from "@miden-sdk/use-miden-para-react";

interface TeamMember {
  id: string;
  name: string;
  avatar: string;
}

interface TeamInvitePageProps {
  searchParams: {
    teamId?: string;
    teamName?: string;
    memberCount?: string;
  };
}

export default function TeamInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loginWithPara, refreshUser, isAuthenticated, isLoading } = useAuth();
  const { openModal } = useModal();
  const [isAccepted, setIsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useParaAccount();
  const [authenticatingWithPara, setAuthenticatingWithPara] = useState(false);
  const { para } = useParaMiden("https://rpc.testnet.miden.io");
  const authAttemptedRef = useRef(false);
  const { data: wallet } = useWallet();

  const companyName = searchParams.get("company");
  const memberCount = parseInt(searchParams.get("teamMemberCount") || "0");
  const token = searchParams.get("token");
  const intendedEmail = searchParams.get("email");
  const companyLogo = searchParams.get("companyLogo");

  const { mutate: acceptInviteByToken, isPending } = useAcceptInvitationByToken();

  const isIntendedUser = user?.email === intendedEmail;

  // Handle Para authentication after wallet connection
  const handleParaAuthentication = useCallback(async () => {
    if (authenticatingWithPara || !isConnected || !para) {
      return;
    }

    setAuthenticatingWithPara(true);
    try {
      const jwtResult = await para.issueJwt();

      if (!jwtResult?.token) {
        throw new Error("Failed to get JWT token from Para");
      }

      // Extract wallet public key
      const publicKey = wallet?.publicKey;

      if (!publicKey) {
        console.error("Wallet public key is missing");
        return;
      }

      await loginWithPara(jwtResult.token, publicKey);
      toast.success("Successfully authenticated");
      await refreshUser();
    } catch (error) {
      console.error("Para authentication failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to authenticate with Para");
    } finally {
      setAuthenticatingWithPara(false);
    }
  }, [isConnected, para, authenticatingWithPara, loginWithPara, refreshUser]);

  // Auto-authenticate once when wallet is connected
  useEffect(() => {
    if (isConnected && !isAuthenticated && !authAttemptedRef.current) {
      authAttemptedRef.current = true;
      handleParaAuthentication();
    }
  }, [isConnected, isAuthenticated, handleParaAuthentication]);

  const handleSignIn = () => {
    openModal();
  };

  // Auto-redirect 1.5s after successful acceptance
  useEffect(() => {
    if (isAccepted) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAccepted, router]);

  const handleAcceptInvite = async () => {
    if (!token) {
      setError("Invalid invitation link");
      return;
    }

    if (!isIntendedUser) {
      setError("This invitation was not sent to your email address. Please sign in with the correct account.");
      return;
    }

    acceptInviteByToken(
      { token },
      {
        onSuccess: () => {
          setIsAccepted(true);
        },
        onError: (err: any) => {
          const errorMessage =
            err?.response?.status === 410
              ? "Your invitation has expired. Please contact your administrator for a new invite."
              : err?.response?.status === 400
                ? "You have already joined this team."
                : "Invalid or expired invitation link. Please check the URL or contact your administrator.";
          setError(errorMessage);
        },
      },
    );
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="rounded-[24px] p-12 max-w-[450px] w-full text-center bg-app-background">
          <div className="mb-6">
            <div className="text-6xl mb-4">✗</div>
            <h2 className="text-2xl font-semibold mb-2">Invitation Error</h2>
            <p className="text-text-secondary text-sm mb-4">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className=" rounded-[24px] p-12 max-w-[450px] w-full text-center bg-app-background">
          <div className="mb-6">
            <div className="text-6xl mb-4">!</div>
            <h2 className="text-2xl font-semibold mb-2">Invalid Invitation Link</h2>
            <p className="text-text-secondary text-sm mb-4">
              The invitation link is missing or invalid. Please check the URL in your email.
            </p>
            <button
              onClick={() => router.push("/")}
              className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User is not signed in - show sign in prompt
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="bg-app-background px-10 py-8 rounded-[24px] w-[510px]">
          {/* Team Icon */}
          <img
            src={companyLogo ? companyLogo : "/logo/qash-icon-dark.svg"}
            alt="Team Icon"
            className="w-30 mb-6 mx-auto"
          />

          {/* Content */}
          <div className="space-y-3">
            {/* Title */}
            <div className="text-center">
              <h1 className="text-2xl font-semibold mb-3">{companyName}</h1>
              <p className="leading-relaxed text-text-secondary">
                Welcome! You've been added to the {companyName}. Sign in to accept the invitation.
              </p>
            </div>

            {/* Team Members Info */}
            <div className="flex items-center justify-center gap-3">
              <div className="flex">
                <img
                  src="/misc/default-team-member-avatar.svg"
                  alt="Team Avatar"
                  className="w-8 h-8 rounded-full border-2 border-background -ml-2"
                />
                <img
                  src="/misc/default-team-member-avatar.svg"
                  alt="Team Avatar"
                  className="w-8 h-8 rounded-full border-2 border-background -ml-2"
                />
                <img
                  src="/misc/default-team-member-avatar.svg"
                  alt="Team Avatar"
                  className="w-8 h-8 rounded-full border-2 border-background -ml-2"
                />
              </div>
              <span className="text-sm text-text-secondary">{memberCount} members</span>
            </div>

            {/* Sign In Button */}
            <PrimaryButton text="Sign in" onClick={handleSignIn} loading={isLoading} />
          </div>
        </div>
      </div>
    );
  }

  // User is signed in
  if (isAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="rounded-[24px] p-12 max-w-[450px] w-full text-center bg-app-background">
          <div className="mb-6">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-semibold mb-2">Welcome to {companyName}!</h2>
            <p className="text-text-secondary text-sm">You have successfully joined the team. Redirecting...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="bg-app-background px-10 py-8 rounded-[24px] w-[510px]">
        {/* Team Icon */}
        <img
          src={companyLogo ? companyLogo : "/logo/qash-icon-dark.svg"}
          alt="Team Icon"
          className="w-30 mb-6 mx-auto"
        />

        {/* Content */}
        <div className="space-y-3">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-3">{companyName}</h1>
            <p className="leading-relaxed text-text-secondary">
              Welcome, {user?.email}! Click below to accept the invitation.
            </p>
          </div>

          {/* Team Members Info */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex">
              <img
                src="/misc/default-team-member-avatar.svg"
                alt="Team Avatar"
                className="w-8 h-8 rounded-full border-2 border-background -ml-2"
              />
              <img
                src="/misc/default-team-member-avatar.svg"
                alt="Team Avatar"
                className="w-8 h-8 rounded-full border-2 border-background -ml-2"
              />
              <img
                src="/misc/default-team-member-avatar.svg"
                alt="Team Avatar"
                className="w-8 h-8 rounded-full border-2 border-background -ml-2"
              />
            </div>
            <span className="text-sm text-text-secondary">{memberCount} members</span>
          </div>

          {/* Join Button */}
          {isIntendedUser ? (
            <PrimaryButton text="Join team" onClick={handleAcceptInvite} loading={isPending} />
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-red-700 text-sm">
                This invitation was sent to {intendedEmail}. Please sign in with that account to accept.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
