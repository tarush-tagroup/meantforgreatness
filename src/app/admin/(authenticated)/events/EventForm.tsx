"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface PhotoItem {
  url: string;
  caption: string;
}

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
    photos?: PhotoItem[];
  };
}

export default function EventForm({ orphanages, initialData }: EventFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [eventDate, setEventDate] = useState(initialData?.eventDate || "");
  const [orphanageId, setOrphanageId] = useState(initialData?.orphanageId || "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [photos, setPhotos] = useState<PhotoItem[]>(initialData?.photos || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 3 - photos.length;
    if (remaining <= 0) {
      setError("Maximum 3 photos per event");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const filesToUpload = Array.from(files).slice(0, remaining);
      const newPhotos: PhotoItem[] = [];

      for (const file of filesToUpload) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error(`${file.name}: Only JPEG, PNG, and WebP images are allowed`);
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name}: File must be under 10 MB`);
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }

        const data = await res.json();
        newPhotos.push({ url: data.url, caption: "" });
      }

      setPhotos((prev) => [...prev, ...newPhotos]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCaption(index: number, caption: string) {
    setPhotos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, caption } : p))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title,
        description,
        active,
        coverImageUrl: photos.length > 0 ? photos[0].url : null,
        photos: photos.map((p, i) => ({
          url: p.url,
          caption: p.caption || null,
          sortOrder: i,
        })),
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

        {/* Photos (up to 3) */}
        <div>
          <label className="block text-sm font-medium text-warmgray-700 mb-1">
            Photos <span className="text-warmgray-400 font-normal">(up to 3)</span>
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              {photos.map((photo, index) => (
                <div key={index} className="space-y-1">
                  <div className="relative group aspect-video rounded-lg overflow-hidden border border-warmgray-200">
                    <Image
                      src={photo.url}
                      alt={photo.caption || `Photo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="33vw"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 rounded-full bg-red-500 text-white w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove photo"
                    >
                      &times;
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 bg-teal-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={photo.caption}
                    onChange={(e) => updateCaption(index, e.target.value)}
                    placeholder="Caption (optional)"
                    className="w-full rounded border border-warmgray-200 px-2 py-1 text-xs text-warmgray-700"
                  />
                </div>
              ))}
            </div>
          )}

          {photos.length < 3 && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="event-photo-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-dashed border-warmgray-300 px-4 py-3 text-sm text-warmgray-600 hover:border-teal-500 hover:text-teal-600 transition-colors w-full disabled:opacity-50"
              >
                {uploading
                  ? "Uploading..."
                  : photos.length === 0
                  ? "Upload Photos"
                  : `Add More Photos (${3 - photos.length} remaining)`}
              </button>
              <p className="text-xs text-warmgray-400 mt-1">
                JPEG, PNG, or WebP. Max 10 MB per file. First photo becomes the cover image.
              </p>
            </div>
          )}
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
