"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EventFormProps {
  orphanages: { id: string; name: string }[];
  initialData?: {
    id: string;
    title: string;
    description: string;
    eventDate: string | null;
    orphanageId: string | null;
    coverImageUrl: string | null;
    active: boolean;
  };
}

export default function EventForm({ orphanages, initialData }: EventFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [eventDate, setEventDate] = useState(initialData?.eventDate || "");
  const [orphanageId, setOrphanageId] = useState(initialData?.orphanageId || "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title,
        description,
        active,
      };
      if (eventDate) payload.eventDate = eventDate;
      if (orphanageId) payload.orphanageId = orphanageId;

      const url = isEditing
        ? `/api/admin/events/${initialData.id}`
        : "/api/admin/events";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      router.push("/admin/events");
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
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-warmgray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-warmgray-700 mb-1">
            Description *
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900 resize-none"
          />
        </div>

        <div>
          <label htmlFor="eventDate" className="block text-sm font-medium text-warmgray-700 mb-1">
            Event Date
          </label>
          <input
            type="date"
            id="eventDate"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-900"
          />
        </div>

        <div>
          <label htmlFor="orphanageId" className="block text-sm font-medium text-warmgray-700 mb-1">
            Related Orphanage
          </label>
          <select
            id="orphanageId"
            value={orphanageId}
            onChange={(e) => setOrphanageId(e.target.value)}
            className="w-full rounded-lg border border-warmgray-200 px-3 py-2 text-sm text-warmgray-700"
          >
            <option value="">None (general event)</option>
            {orphanages.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-warmgray-300 text-teal-600 focus:ring-teal-500"
          />
          <label htmlFor="active" className="text-sm text-warmgray-700">
            Active (visible on public site)
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !title || !description}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : isEditing ? "Update Event" : "Create Event"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/events")}
          className="rounded-lg border border-warmgray-200 px-4 py-2 text-sm font-medium text-warmgray-600 hover:bg-warmgray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
