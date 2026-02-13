"use client";

import { useEffect } from "react";

/**
 * Root error boundary — catches errors that segment boundaries miss,
 * including errors in the root layout itself.
 * Must include its own <html> and <body> (Next.js requirement).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);

    // Report to centralized logs
    fetch("/api/log-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [
          {
            level: "error",
            source: "frontend:error-boundary",
            message: error.message || "Unknown global error",
            meta: {
              digest: error.digest,
              stack: error.stack?.slice(0, 1000),
              url: typeof window !== "undefined" ? window.location.pathname : "unknown",
            },
          },
        ],
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <svg width={28} height={28} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#dc2626">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 24, maxWidth: 400 }}>
            An unexpected error occurred. Please try again, or contact us if the problem persists.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{ backgroundColor: "#1a1a1a", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
