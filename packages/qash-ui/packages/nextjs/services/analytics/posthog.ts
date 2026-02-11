import posthog from "posthog-js";
import { PostHogEvent, PostHogEventProperties } from "@/types/posthog";

// ─── Typed event capture ─────────────────────────────────────────────────────

/**
 * Capture a PostHog event with type-safe properties.
 *
 * No-ops silently when PostHog is not initialised (e.g. local dev).
 */
export function trackEvent<E extends PostHogEvent>(event: E, properties?: PostHogEventProperties[E]): void {
  try {
    if (typeof window === "undefined") return;
    posthog.capture(event, properties as Record<string, unknown>);
  } catch {
    // fail silently – analytics should never break the app
  }
}

/**
 * Identify the current user in PostHog.
 */
export function identifyUser(
  userId: string,
  traits?: {
    email?: string;
    companyId?: number;
    companyName?: string;
    role?: string;
    walletAddress?: string;
  },
): void {
  try {
    if (typeof window === "undefined") return;
    posthog.identify(userId, traits);
  } catch {
    // fail silently
  }
}

/**
 * Set or update a user property without triggering an event.
 */
export function setUserProperty(key: string, value: string | number | boolean): void {
  try {
    if (typeof window === "undefined") return;
    posthog.people.set({ [key]: value });
  } catch {
    // fail silently
  }
}

/**
 * Reset PostHog identity (call on logout).
 */
export function resetAnalytics(): void {
  try {
    if (typeof window === "undefined") return;
    posthog.reset();
  } catch {
    // fail silently
  }
}

/**
 * Set a one-time "super property" that attaches to every event.
 */
export function setSuperProperty(key: string, value: string | number | boolean): void {
  try {
    if (typeof window === "undefined") return;
    posthog.register({ [key]: value });
  } catch {
    // fail silently
  }
}
