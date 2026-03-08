"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ClassGroupData {
  id: string;
  name: string;
  studentCount: number;
  ageRange: string;
  sortOrder: number;
}

export default function ClassGroupManager({
  orphanageId,
  initialGroups,
}: {
  orphanageId: string;
  initialGroups: ClassGroupData[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // New group form state (only name)
  const [newGroupName, setNewGroupName] = useState("");

  // Edit form state (only name)
  const [editName, setEditName] = useState("");

  async function handleAdd() {
    if (!newGroupName.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/admin/class-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orphanageId,
          name: newGroupName.trim(),
          studentCount: 0,
          sortOrder: groups.length,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        return;
      }

      setNewGroupName("");
      setAdding(false);
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const group = groups.find((g) => g.id === id);
      const res = await fetch(`/api/admin/class-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          studentCount: group?.studentCount ?? 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update");
        return;
      }

      setGroups(
        groups.map((g) =>
          g.id === id ? { ...g, name: editName.trim() } : g
        )
      );
      setEditingId(null);
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const group = groups.find((g) => g.id === id);
    const msg =
      group && group.studentCount > 0
        ? `Delete "${group.name}"? ${group.studentCount} kid(s) in this class will become unassigned.`
        : `Delete this class group?`;
    if (!confirm(msg)) return;

    setError("");

    try {
      const res = await fetch(`/api/admin/class-groups/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        return;
      }

      setGroups(groups.filter((g) => g.id !== id));
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    }
  }

  function startEdit(group: ClassGroupData) {
    setEditingId(group.id);
    setEditName(group.name);
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {groups.length === 0 && !adding && (
        <p className="text-sm text-sand-400">No class groups yet.</p>
      )}

      {groups.map((group) =>
        editingId === group.id ? (
          <div
            key={group.id}
            className="rounded-lg border border-green-200 bg-green-50/50 p-4 space-y-3"
          >
            <div>
              <label className="block text-xs font-medium text-sand-500 mb-1">
                Class Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Class name"
                className="w-full rounded-lg border border-sand-300 px-3 py-1.5 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdate(group.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleUpdate(group.id)}
                disabled={saving}
                className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "..." : "Save"}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="rounded px-3 py-1 text-xs font-medium text-sand-500 hover:text-sand-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            key={group.id}
            className="flex items-center justify-between rounded-lg border border-sand-200 bg-sand-50 p-4"
          >
            <div>
              <p className="text-sm font-medium text-sand-800">
                {group.name}
              </p>
              <p className="text-xs text-sand-500">
                {group.studentCount} student{group.studentCount !== 1 ? "s" : ""}
                {group.ageRange ? ` · Ages ${group.ageRange}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(group)}
                className="text-xs text-sand-400 hover:text-sand-600"
              >
                rename
              </button>
              <button
                onClick={() => handleDelete(group.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                delete
              </button>
            </div>
          </div>
        )
      )}

      {adding ? (
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-sand-500 mb-1">
              Class Name
            </label>
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Kids I, Junior, Young Adult"
              className="w-full rounded-lg border border-sand-300 px-3 py-1.5 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setAdding(false);
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "..." : "Add"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded px-3 py-1 text-xs font-medium text-sand-500 hover:text-sand-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-lg border-2 border-dashed border-sand-200 py-3 text-sm font-medium text-sand-400 hover:border-sand-300 hover:text-sand-500 transition-colors"
        >
          + Add Class Group
        </button>
      )}
    </div>
  );
}
