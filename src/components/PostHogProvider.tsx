"use client";

import posthog, { PostHog } from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect, useState, Suspense } from "react";
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
 * IMPORTANT: Always renders children on both server & client to avoid
 * hydration mismatches. PostHog init is deferred to a useEffect.
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

  const [client, setClient] = useState<PostHog | null>(null);

  useEffect(() => {
    if (key) {
      setClient(getOrCreateInstance(key, host));
    }
  }, [key, host]);

  // Before PostHog initializes (server + first client render), render
  // children without the provider — same output on both sides, no mismatch.
  if (!client) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={client}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
