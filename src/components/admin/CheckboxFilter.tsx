"use client";

import { useEffect, useRef, useState } from "react";

interface CheckboxFilterProps {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function CheckboxFilter({
  label,
  options,
  selected,
  onChange,
}: CheckboxFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
          selected.length > 0
            ? "border-green-300 bg-green-50 text-green-700"
            : "border-sand-300 bg-white text-sand-700 hover:bg-sand-50"
        }`}
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white">
            {selected.length}
          </span>
        )}
        <svg
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1 w-56 rounded-lg border border-sand-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-3 py-1.5 text-left text-xs text-sand-500 hover:text-sand-700 hover:bg-sand-50"
            >
              Clear all
            </button>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-sand-700 hover:bg-sand-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="h-3.5 w-3.5 rounded border-sand-300 text-green-600 focus:ring-green-500"
                />
                <span className="truncate">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
