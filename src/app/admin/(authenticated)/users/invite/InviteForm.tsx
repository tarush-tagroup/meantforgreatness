"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types/auth";

const AVAILABLE_ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access — manage users, settings, and all content",
  },
  {
    value: "teacher",
    label: "Teacher",
    description: "View classes, create/edit own class logs, manage events",
  },
  {
    value: "teacher_manager",
    label: "Teacher Manager",
    description:
      "Everything a teacher can do, plus edit any class log and manage orphanages",
  },
  {
    value: "donor_manager",
    label: "Donor Manager",
    description: "View donation records and statistics",
  },
];

export default function InviteForm() {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (roles.length === 0) {
      setError("Please select at least one role.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, roles }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invitation.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/admin/users"), 2000);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
        <p className="text-sm font-medium text-green-700">
          Invitation sent to {email}!
        </p>
        <p className="mt-1 text-xs text-green-600">
          Redirecting to user list...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-warmgray-700"
        >
          Email address
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teacher@example.com"
          className="mt-1 block w-full rounded-lg border border-warmgray-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          required
        />
        <p className="mt-1 text-xs text-warmgray-400">
          They must have a Google account with this email to log in.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-warmgray-700">
          Roles
        </label>
        <div className="mt-2 space-y-3">
          {AVAILABLE_ROLES.map(({ value, label, description }) => (
            <label
              key={value}
              className="flex items-start gap-3 rounded-lg border border-warmgray-200 p-3 transition-colors hover:bg-warmgray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={roles.includes(value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setRoles([...roles, value]);
                  } else {
                    setRoles(roles.filter((r) => r !== value));
                  }
                }}
                className="mt-0.5 rounded border-warmgray-300"
              />
              <div>
                <p className="text-sm font-medium text-warmgray-900">
                  {label}
                </p>
                <p className="text-xs text-warmgray-500">{description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-50"
      >
        {loading ? "Sending invitation..." : "Send Invitation"}
      </button>
    </form>
  );
}
