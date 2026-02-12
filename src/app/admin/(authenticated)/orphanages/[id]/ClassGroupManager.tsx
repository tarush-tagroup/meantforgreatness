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

  // New group form state
  const [newGroup, setNewGroup] = useState({
    name: "",
    studentCount: 0,
    ageRange: "",
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    studentCount: 0,
    ageRange: "",
  });

  async function handleAdd() {
    if (!newGroup.name) {
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
          name: newGroup.name,
          studentCount: newGroup.studentCount,
          ageRange: newGroup.ageRange || undefined,
          sortOrder: groups.length,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        return;
      }

      const data = await res.json();
      setGroups([
        ...groups,
        {
          id: data.classGroup.id,
          name: data.classGroup.name,
          studentCount: data.classGroup.studentCount,
          ageRange: data.classGroup.ageRange || "",
          sortOrder: data.classGroup.sortOrder,
        },
      ]);
      setNewGroup({ name: "", studentCount: 0, ageRange: "" });
      setAdding(false);
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/class-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          studentCount: editForm.studentCount,
          ageRange: editForm.ageRange || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update");
        return;
      }

      setGroups(
        groups.map((g) =>
          g.id === id
            ? {
                ...g,
                name: editForm.name,
                studentCount: editForm.studentCount,
                ageRange: editForm.ageRange,
              }
            : g
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
    if (!confirm("Delete this class group?")) return;

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
    setEditForm({
      name: group.name,
      studentCount: group.studentCount,
      ageRange: group.ageRange,
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {groups.length === 0 && !adding && (
        <p className="text-sm text-warmgray-400">No class groups yet.</p>
      )}

      {groups.map((group) =>
        editingId === group.id ? (
          <div
            key={group.id}
            className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 space-y-3"
          >
            <div className="grid grid-cols-3 gap-3">
              <input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Name"
                className="rounded-lg border border-warmgray-300 px-3 py-1.5 text-sm"
              />
              <input
                type="number"
                min={0}
                value={editForm.studentCount}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    studentCount: Number(e.target.value),
                  })
                }
                placeholder="Students"
                className="rounded-lg border border-warmgray-300 px-3 py-1.5 text-sm"
              />
              <input
                value={editForm.ageRange}
                onChange={(e) =>
                  setEditForm({ ...editForm, ageRange: e.target.value })
                }
                placeholder="Age range"
                className="rounded-lg border border-warmgray-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdate(group.id)}
                disabled={saving}
                className="rounded bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "..." : "Save"}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="rounded px-3 py-1 text-xs font-medium text-warmgray-500 hover:text-warmgray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            key={group.id}
            className="flex items-center justify-between rounded-lg border border-warmgray-200 bg-warmgray-50 p-4"
          >
            <div>
              <p className="text-sm font-medium text-warmgray-800">
                {group.name}
              </p>
              <p className="text-xs text-warmgray-500">
                {group.studentCount} students
                {group.ageRange ? ` · Ages ${group.ageRange}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(group)}
                className="text-xs text-warmgray-400 hover:text-warmgray-600"
              >
                edit
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
        <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input
              value={newGroup.name}
              onChange={(e) =>
                setNewGroup({ ...newGroup, name: e.target.value })
              }
              placeholder="Group name"
              className="rounded-lg border border-warmgray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              min={0}
              value={newGroup.studentCount}
              onChange={(e) =>
                setNewGroup({
                  ...newGroup,
                  studentCount: Number(e.target.value),
                })
              }
              placeholder="Students"
              className="rounded-lg border border-warmgray-300 px-3 py-1.5 text-sm"
            />
            <input
              value={newGroup.ageRange}
              onChange={(e) =>
                setNewGroup({ ...newGroup, ageRange: e.target.value })
              }
              placeholder="Age range (e.g. 8–12)"
              className="rounded-lg border border-warmgray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded bg-teal-600 px-3 py-1 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "..." : "Add"}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded px-3 py-1 text-xs font-medium text-warmgray-500 hover:text-warmgray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-lg border-2 border-dashed border-warmgray-200 py-3 text-sm font-medium text-warmgray-400 hover:border-warmgray-300 hover:text-warmgray-500 transition-colors"
        >
          + Add Class Group
        </button>
      )}
    </div>
  );
}
