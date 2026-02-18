"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  orphanages: { id: string; name: string }[];
}

export default function KidCreateForm({ orphanages }: Props) {
  const [form, setForm] = useState({
    name: "",
    age: 0,
    hobby: "",
    location: "",
    about: "",
    favoriteWord: "",
    orphanageId: "",
  });
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    setSaving(true);

    try {
      const res = await fetch("/api/admin/kids", {
        method: "POST",
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
        setError(data.error || "Failed to create kid profile");
        return;
      }

      const data = await res.json();
      router.push(`/admin/kids/${data.id}`);
      router.refresh();
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
            placeholder="e.g. Sari"
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
            placeholder="e.g. Kupang, East Nusa Tenggara"
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
          placeholder="Tell this child's story..."
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
          placeholder="Their favorite English word and why..."
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
              alt="Kid"
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

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Kid Profile"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/kids")}
          className="rounded-lg border border-sand-300 px-4 py-2.5 text-sm font-medium text-sand-700 transition-colors hover:bg-sand-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
