"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/types/auth";

const ALL_ROLES: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "teacher_manager", label: "Teacher Manager" },
  { value: "donor_manager", label: "Donor Manager" },
];

interface RoleEditorProps {
  userId: string;
  currentRoles: Role[];
  isSelf: boolean;
}

export default function RoleEditor({
  userId,
  currentRoles,
  isSelf,
}: RoleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [roles, setRoles] = useState<Role[]>(currentRoles);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (roles.length === 0) {
      alert("At least one role is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update roles");
        return;
      }

      setEditing(false);
      router.refresh();
    } catch {
      alert("Failed to update roles");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {currentRoles.map((role) => (
          <span
            key={role}
            className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20"
          >
            {role.replace("_", " ")}
          </span>
        ))}
        <button
          onClick={() => setEditing(true)}
          className="ml-1 text-xs text-warmgray-400 hover:text-warmgray-600"
          title="Edit roles"
        >
          edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ALL_ROLES.map(({ value, label }) => {
        const isDisabled = isSelf && value === "admin";
        return (
          <label
            key={value}
            className={`flex items-center gap-2 text-xs ${isDisabled ? "opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              checked={roles.includes(value)}
              disabled={isDisabled}
              onChange={(e) => {
                if (e.target.checked) {
                  setRoles([...roles, value]);
                } else {
                  setRoles(roles.filter((r) => r !== value));
                }
              }}
              className="rounded border-warmgray-300"
            />
            {label}
          </label>
        );
      })}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || roles.length === 0}
          className="rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? "..." : "Save"}
        </button>
        <button
          onClick={() => {
            setRoles(currentRoles);
            setEditing(false);
          }}
          className="rounded px-2 py-1 text-xs font-medium text-warmgray-500 hover:text-warmgray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
