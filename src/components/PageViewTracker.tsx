"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Get or create a session ID for correlating page views.
 * Stored in sessionStorage so it persists across navigations
 * but resets when the tab is closed.
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem("_mfg_sid");
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem("_mfg_sid", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).substring(2, 10);
  }
}

function sendLog(
  source: string,
  message: string,
  meta?: Record<string, unknown>
) {
  const payload = JSON.stringify({
    entries: [
      {
        level: "info",
        source,
        message,
        meta: {
          ...meta,
          sessionId: getSessionId(),
        },
      },
    ],
  });

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/log-client", payload);
  } else {
    fetch("/api/log-client", {
      method: "POST",
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

/**
 * Track a named user interaction event.
 * Import and call from any client component:
 *   import { trackEvent } from "@/components/PageViewTracker";
 *   trackEvent("donate_click", { amount: "50" });
 */
export function trackEvent(name: string, meta?: Record<string, string>) {
  sendLog("frontend:event", name, {
    ...meta,
    url: typeof window !== "undefined" ? window.location.pathname : "",
  });
}

/**
 * Tracks page views via Next.js pathname changes.
 * Renders nothing — purely a side-effect component.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    // Skip duplicate navigations to the same path
    if (pathname === lastPathRef.current) return;

    // Debounce rapid navigations (500ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      lastPathRef.current = pathname;

      sendLog("frontend:pageview", pathname, {
        referrer: document.referrer?.slice(0, 200) || "",
        screenWidth: window.screen?.width,
        screenHeight: window.screen?.height,
        language: navigator.language,
      });
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pathname]);

  return null;
}
