"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ClassLogFormProps {
  orphanages: { id: string; name: string }[];
  teachers: { id: string; name: string | null; email: string }[];
  currentUserId: string;
  isTeacherLocked: boolean;
  initialData?: {
    id: string;
    orphanageId: string;
    classDate: string;
    classTime: string | null;
    studentCount: number | null;
    notes: string | null;
  };
}

export default function ClassLogForm({
  orphanages,
  teachers,
  currentUserId,
  isTeacherLocked,
  initialData,
}: ClassLogFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [orphanageId, setOrphanageId] = useState(initialData?.orphanageId || "");
  const [classDate, setClassDate] = useState(
    initialData?.classDate || new Date().toISOString().split("T")[0]
  );
  const [classTime, setClassTime] = useState(initialData?.classTime || "");
  const [studentCount, setStudentCount] = useState(
    initialData?.studentCount?.toString() || ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        orphanageId,
        classDate,
      };
      if (classTime) payload.classTime = classTime;
      if (studentCount) payload.studentCount = parseInt(studentCount);
      if (notes) payload.notes = notes;

      const url = isEditing
        ? `/api/admin/class-logs/${initialData.id}`
        : "/api/admin/class-logs";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      router.push("/admin/classes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-warmgray-200 bg-white p-6 space-y-5">
        {/* Orphanage */}
        <div>
          <label
            htmlFor="orphanageId"
            className="block text-sm font-medium text-warmgray-700 mb-1"
          >
            Orphanage *
          </label>
          <select
            id="orphanageId"
            value={orphanageId}
            onChange={(e) => setOrphanageId(e.target.value)}
            required
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900"
          >
            <option value="">Select orphanage</option>
            {orphanages.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Teacher (locked for teacher role) */}
        <div>
          <label
            htmlFor="teacher"
            className="block text-sm font-medium text-warmgray-700 mb-1"
          >
            Teacher
          </label>
          {isTeacherLocked ? (
            <div className="rounded-lg bg-warmgray-50 border border-warmgray-200 px-3 py-2 text-sm text-warmgray-600">
              {teachers.find((t) => t.id === currentUserId)?.name || "You"}{" "}
              <span className="text-warmgray-400">(locked to your account)</span>
            </div>
          ) : (
            <div className="rounded-lg bg-warmgray-50 border border-warmgray-200 px-3 py-2 text-sm text-warmgray-600">
              {teachers.find((t) => t.id === currentUserId)?.name || "You"}{" "}
              <span className="text-warmgray-400">(your account)</span>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label
            htmlFor="classDate"
            className="block text-sm font-medium text-warmgray-700 mb-1"
          >
            Class Date *
          </label>
          <input
            type="date"
            id="classDate"
            value={classDate}
            onChange={(e) => setClassDate(e.target.value)}
            required
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900"
          />
        </div>

        {/* Time */}
        <div>
          <label
            htmlFor="classTime"
            className="block text-sm font-medium text-warmgray-700 mb-1"
          >
            Class Time
          </label>
          <input
            type="text"
            id="classTime"
            value={classTime}
            onChange={(e) => setClassTime(e.target.value)}
            placeholder="e.g. 10:00 AM"
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900"
          />
        </div>

        {/* Student Count */}
        <div>
          <label
            htmlFor="studentCount"
            className="block text-sm font-medium text-warmgray-700 mb-1"
          >
            Students Present
          </label>
          <input
            type="number"
            id="studentCount"
            value={studentCount}
            onChange={(e) => setStudentCount(e.target.value)}
            min="0"
            placeholder="Number of students"
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900"
          />
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-warmgray-700 mb-1"
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="What was covered in class, observations, etc."
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900 resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !orphanageId || !classDate}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : isEditing ? "Update Class Log" : "Save Class Log"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/classes")}
          className="rounded-lg border border-warmgray-200 px-4 py-2 text-sm font-medium text-warmgray-600 hover:bg-warmgray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
