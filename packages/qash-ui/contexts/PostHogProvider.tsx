"use client";

import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/services/auth/context";
import { identifyUser, resetAnalytics } from "@/services/analytics/posthog";

// ─── Configuration ───────────────────────────────────────────────────────────

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT ?? "development";

/** PostHog only runs in production / staging */
const isEnabled = !!POSTHOG_KEY && (ENVIRONMENT === "production" || ENVIRONMENT === "staging");

// ─── Context ─────────────────────────────────────────────────────────────────

interface PostHogContextValue {
  /** The raw PostHog client – null when disabled */
  posthog: typeof posthog | null;
}

const PostHogContext = createContext<PostHogContextValue>({ posthog: null });

// ─── Page-view tracker ───────────────────────────────────────────────────────

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isEnabled || !pathname) return;
    const url = searchParams?.toString()
      ? `${window.origin}${pathname}?${searchParams.toString()}`
      : `${window.origin}${pathname}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// ─── User identifier ─────────────────────────────────────────────────────────

function PostHogUserIdentifier() {
  const { isAuthenticated, user } = useAuth();
  const previousUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isEnabled) return;

    if (isAuthenticated && user) {
      const userId = user.email ?? String(user.id);
      // Only identify when user changes
      if (previousUser.current !== userId) {
        previousUser.current = userId;

        const company = (user as Record<string, unknown>).company as { id?: number; name?: string } | undefined;

        identifyUser(userId, {
          email: user.email ?? undefined,
          companyId: company?.id,
          companyName: company?.name ?? undefined,
          role: (user as Record<string, unknown>).role as string | undefined,
        });
      }
    } else if (!isAuthenticated && previousUser.current) {
      previousUser.current = null;
      resetAnalytics();
    }
  }, [isAuthenticated, user]);

  return null;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: ReactNode }) {
  const initRef = useRef(false);

  useEffect(() => {
    if (!isEnabled || initRef.current) return;
    initRef.current = true;

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Automatic page-view capture is handled manually via PostHogPageView
      capture_pageview: false,
      capture_pageleave: true,
      // Session recording
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".ph-mask",
      },
      // Performance
      autocapture: true,
      persistence: "localStorage+cookie",
      // Respect Do Not Track
      respect_dnt: true,
      // Debug in staging only
      loaded: ph => {
        if (ENVIRONMENT === "staging") ph.debug();
      },
    });
  }, []);

  return (
    <PostHogContext.Provider value={{ posthog: isEnabled ? posthog : null }}>
      <PostHogPageView />
      <PostHogUserIdentifier />
      {children}
    </PostHogContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Access the PostHog client from any component.
 * Returns `null` when PostHog is disabled (e.g. local dev).
 */
export function usePostHog() {
  return useContext(PostHogContext).posthog;
}
