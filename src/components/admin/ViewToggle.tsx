"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ViewToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") || "grid";

  function toggle(mode: "grid" | "list") {
    const p = new URLSearchParams(searchParams.toString());
    if (mode === "grid") p.delete("view");
    else p.set("view", mode);
    const qs = p.toString();
    router.push(`?${qs}`, { scroll: false });
  }

  return (
    <div className="inline-flex rounded-lg border border-sand-200 p-0.5">
      <button
        type="button"
        onClick={() => toggle("grid")}
        className={`rounded-md p-1.5 transition-colors ${
          view === "grid"
            ? "bg-sand-900 text-white"
            : "text-sand-400 hover:text-sand-600"
        }`}
        aria-label="Grid view"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => toggle("list")}
        className={`rounded-md p-1.5 transition-colors ${
          view === "list"
            ? "bg-sand-900 text-white"
            : "text-sand-400 hover:text-sand-600"
        }`}
        aria-label="List view"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
        </svg>
      </button>
    </div>
  );
}
