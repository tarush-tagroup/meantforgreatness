"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OrphanageData {
  id: string;
  name: string;
  indonesianName: string | null;
  address: string | null;
  location: string;
  description: string;
  curriculum: string | null;
  runningSince: string | null;
  imageUrl: string | null;
  studentCount: number;
  classesPerWeek: number;
  hoursPerWeek: number | null;
  latitude: number | null;
  longitude: number | null;
  websiteUrl: string | null;
}

export default function OrphanageEditForm({
  orphanage,
}: {
  orphanage: OrphanageData;
}) {
  const [form, setForm] = useState({
    name: orphanage.name,
    indonesianName: orphanage.indonesianName || "",
    address: orphanage.address || "",
    location: orphanage.location,
    description: orphanage.description,
    curriculum: orphanage.curriculum || "",
    runningSince: orphanage.runningSince || "",
    studentCount: orphanage.studentCount,
    classesPerWeek: orphanage.classesPerWeek,
    hoursPerWeek: orphanage.hoursPerWeek || 0,
    websiteUrl: orphanage.websiteUrl || "",
  });
  const [imageUrl, setImageUrl] = useState(orphanage.imageUrl || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>(
    orphanage.latitude && orphanage.longitude
      ? `GPS: ${orphanage.latitude.toFixed(6)}, ${orphanage.longitude.toFixed(6)}`
      : "No GPS coordinates set"
  );
  const router = useRouter();

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      formData.append("orphanageId", orphanage.id);

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
      const res = await fetch(`/api/admin/orphanages/${orphanage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          indonesianName: form.indonesianName || null,
          address: form.address || null,
          curriculum: form.curriculum || null,
          runningSince: form.runningSince || null,
          hoursPerWeek: form.hoursPerWeek || null,
          imageUrl: imageUrl || null,
          websiteUrl: form.websiteUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      const data = await res.json();
      // Update GPS status if coordinates were computed
      if (data.latitude && data.longitude) {
        setGpsStatus(`GPS: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
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

  async function handleGeocode() {
    if (!form.address) {
      setError("Enter an address first to compute GPS coordinates");
      return;
    }

    setGeocoding(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/orphanages/${orphanage.id}/geocode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: form.address }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Geocoding failed");
        return;
      }

      const data = await res.json();
      if (data.latitude && data.longitude) {
        setGpsStatus(`GPS: ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`);
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError("Could not find GPS coordinates for this address. Try a more specific address.");
      }
    } catch {
      setError("Geocoding failed. Please try again.");
    } finally {
      setGeocoding(false);
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
            Indonesian Name
          </label>
          <input
            name="indonesianName"
            value={form.indonesianName}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Location *
        </label>
        <input
          name="location"
          value={form.location}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Address
        </label>
        <div className="flex gap-2 mt-1">
          <input
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Full street address for GPS geocoding"
            className="flex-1 rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <button
            type="button"
            onClick={handleGeocode}
            disabled={geocoding || !form.address}
            className="rounded-lg bg-sand-100 px-3 py-2 text-xs font-medium text-sand-700 hover:bg-sand-200 transition-colors disabled:opacity-50 whitespace-nowrap"
            title="Compute GPS coordinates from address"
          >
            {geocoding ? "Finding..." : "Get GPS"}
          </button>
        </div>
        <p className="mt-1 text-xs text-sand-400">
          {gpsStatus}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Website URL
        </label>
        <input
          name="websiteUrl"
          value={form.websiteUrl}
          onChange={handleChange}
          placeholder="https://example.com/orphanage-page"
          className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <p className="mt-1 text-xs text-sand-400">
          Link to orphanage website or listing for additional verification
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Description *
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          required
          rows={4}
          className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Student Count *
          </label>
          <input
            name="studentCount"
            type="number"
            min={0}
            value={form.studentCount}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Classes per Week *
          </label>
          <input
            name="classesPerWeek"
            type="number"
            min={0}
            value={form.classesPerWeek}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Hours per Week
          </label>
          <input
            name="hoursPerWeek"
            type="number"
            min={0}
            value={form.hoursPerWeek}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Curriculum
          </label>
          <input
            name="curriculum"
            value={form.curriculum}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-sand-700">
            Running Since
          </label>
          <input
            name="runningSince"
            value={form.runningSince}
            onChange={handleChange}
            placeholder="e.g. September 2024"
            className="mt-1 block w-full rounded-lg border border-sand-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-sand-700">
          Image
        </label>
        {imageUrl && (
          <div className="mt-1 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Orphanage"
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
