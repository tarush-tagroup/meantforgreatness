"use client";

import { useEffect, useRef } from "react";

/**
 * Global client-side error reporter.
 * Captures unhandled JS errors and promise rejections,
 * then beacons them to /api/log-client for centralized logging.
 * Renders nothing — purely a side-effect component.
 */
export default function ErrorReporter() {
  const reportedRef = useRef(new Set<string>());
  const countRef = useRef(0);
  const MAX_ERRORS = 5; // per page load

  useEffect(() => {
    function sendError(
      message: string,
      meta: Record<string, unknown>
    ) {
      // Deduplicate by message hash
      const key = message.slice(0, 200);
      if (reportedRef.current.has(key)) return;
      reportedRef.current.add(key);

      // Cap at MAX_ERRORS per page load
      countRef.current++;
      if (countRef.current > MAX_ERRORS) return;

      const payload = JSON.stringify({
        entries: [
          {
            level: "error",
            source: "frontend:error",
            message,
            meta: {
              ...meta,
              url: window.location.pathname,
              userAgent: navigator.userAgent.slice(0, 200),
            },
          },
        ],
      });

      // sendBeacon is reliable even during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/log-client", payload);
      } else {
        fetch("/api/log-client", {
          method: "POST",
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    }

    function handleError(event: ErrorEvent) {
      sendError(event.message || "Unknown error", {
        filename: event.filename?.slice(0, 300),
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack?.slice(0, 1000),
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      sendError(message, {
        stack:
          reason instanceof Error
            ? reason.stack?.slice(0, 1000)
            : undefined,
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
