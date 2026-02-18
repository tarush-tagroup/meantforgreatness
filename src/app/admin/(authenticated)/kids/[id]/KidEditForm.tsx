"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface KidData {
  id: string;
  name: string;
  age: number;
  hobby: string | null;
  location: string | null;
  about: string | null;
  favoriteWord: string | null;
  imageUrl: string | null;
  orphanageId: string | null;
}

interface Props {
  kid: KidData;
  orphanages: { id: string; name: string }[];
}

export default function KidEditForm({ kid, orphanages }: Props) {
  const [form, setForm] = useState({
    name: kid.name,
    age: kid.age,
    hobby: kid.hobby || "",
    location: kid.location || "",
    about: kid.about || "",
    favoriteWord: kid.favoriteWord || "",
    orphanageId: kid.orphanageId || "",
  });
  const [imageUrl, setImageUrl] = useState(kid.imageUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "kids");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Upload failed");
        return;
      }

      const data = await res.json();
      setImageUrl(data.url);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/kids/${kid.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          hobby: form.hobby || null,
          location: form.location || null,
          about: form.about || null,
          favoriteWord: form.favoriteWord || null,
          imageUrl: imageUrl || null,
          orphanageId: form.orphanageId || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Saved successfully!
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Name *
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Age *
          </label>
          <input
            name="age"
            type="number"
            min={0}
            max={30}
            value={form.age}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">Hobby</label>
        <input
          name="hobby"
          value={form.hobby}
          onChange={handleChange}
          placeholder="e.g. Playing Football"
          className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-sand-700">
            From (Location)
          </label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Orphanage *
          </label>
          <select
            name="orphanageId"
            value={form.orphanageId}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Select orphanage...</option>
            {orphanages.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">About</label>
        <textarea
          name="about"
          value={form.about}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Favorite Word
        </label>
        <textarea
          name="favoriteWord"
          value={form.favoriteWord}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Photo
        </label>
        {imageUrl && (
          <div className="mt-1 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={kid.name}
              className="h-32 w-auto rounded-lg object-cover"
            />
          </div>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageUpload}
          disabled={uploading}
          className="mt-1 block w-full text-sm text-sand-500 file:mr-4 file:rounded-lg file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
        />
        {uploading && (
          <p className="mt-1 text-xs text-sand-400">Uploading...</p>
        )}
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
