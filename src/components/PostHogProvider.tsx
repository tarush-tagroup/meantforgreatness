"use client";

import posthog, { PostHog } from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, Suspense, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Cache PostHog instances by API key so we never double-init */
const instances = new Map<string, PostHog>();

function getOrCreateInstance(apiKey: string, apiHost: string): PostHog {
  if (instances.has(apiKey)) return instances.get(apiKey)!;

  // First key uses the default singleton; subsequent keys get a named instance
  const isFirst = instances.size === 0;
  const ph = isFirst ? posthog : new PostHog();

  ph.init(apiKey, {
    api_host: apiHost,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    ...(isFirst ? {} : { name: apiKey }),
  });

  instances.set(apiKey, ph);
  return ph;
}

/** SSR-safe check: returns false on server, true on client */
const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname;
      const search = searchParams.toString();
      if (search) url += `?${search}`;
      ph.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, ph]);

  return null;
}

/**
 * Wrap a subtree with PostHog analytics.
 *
 * - Public site + donor portal: uses NEXT_PUBLIC_POSTHOG_KEY (default)
 * - Admin portal: uses NEXT_PUBLIC_POSTHOG_ADMIN_KEY
 *
 * Pass `apiKey` and optionally `apiHost` to override the defaults.
 *
 * Uses useSyncExternalStore to safely detect client-side rendering
 * and avoid hydration mismatches.
 */
export default function PostHogProvider({
  children,
  apiKey,
  apiHost,
}: {
  children: React.ReactNode;
  apiKey?: string;
  apiHost?: string;
}) {
  const key = apiKey || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    apiHost ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    "https://us.i.posthog.com";

  const isClient = useIsClient();

  if (!isClient || !key) {
    return <>{children}</>;
  }

  const client = getOrCreateInstance(key, host);

  return (
    <PHProvider client={client}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
