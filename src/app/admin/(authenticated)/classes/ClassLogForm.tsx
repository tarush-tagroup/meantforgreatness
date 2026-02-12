"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface GpsData {
  latitude: number;
  longitude: number;
}

interface PhotoItem {
  url: string;
  caption?: string | null;
  gps?: GpsData | null;
}

interface AiMetadata {
  aiKidsCount: number | null;
  aiLocation: string | null;
  aiPhotoTimestamp: string | null;
  aiOrphanageMatch: string | null;
  aiConfidenceNotes: string | null;
  aiPrimaryPhotoUrl: string | null;
  aiAnalyzedAt: string | null;
}

interface ClassLogFormProps {
  orphanages: { id: string; name: string }[];
  teachers: { id: string; name: string | null; email: string }[];
  currentUserId: string;
  isTeacherLocked: boolean;
  aiMetadata?: AiMetadata | null;
  initialData?: {
    id: string;
    orphanageId: string;
    classDate: string;
    classTime: string | null;
    studentCount: number | null;
    notes: string | null;
    photos?: { url: string; caption: string | null }[];
  };
}

function matchBadgeColor(match: string | null) {
  switch (match) {
    case "high":
      return "bg-green-100 text-green-800";
    case "likely":
      return "bg-teal-100 text-teal-800";
    case "uncertain":
      return "bg-amber-100 text-amber-800";
    case "unlikely":
      return "bg-red-100 text-red-800";
    default:
      return "bg-warmgray-100 text-warmgray-600";
  }
}

export default function ClassLogForm({
  orphanages,
  teachers,
  currentUserId,
  isTeacherLocked,
  aiMetadata,
  initialData,
}: ClassLogFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orphanageId, setOrphanageId] = useState(initialData?.orphanageId || "");
  const [classDate, setClassDate] = useState(
    initialData?.classDate || new Date().toISOString().split("T")[0]
  );
  const [classTime, setClassTime] = useState(initialData?.classTime || "");
  const [studentCount, setStudentCount] = useState(
    initialData?.studentCount?.toString() || ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [photos, setPhotos] = useState<PhotoItem[]>(
    initialData?.photos?.map((p) => ({ url: p.url, caption: p.caption })) || []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setUploading(true);

    try {
      const newPhotos: PhotoItem[] = [];

      for (const file of Array.from(files)) {
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
        newPhotos.push({ url: data.url, caption: null, gps: data.gps || null });
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (photos.length === 0) {
      setError("At least one photo is required");
      return;
    }

    setSaving(true);

    try {
      // Find first photo with GPS data to pass along for location verification
      const firstGps = photos.find((p) => p.gps)?.gps || null;

      const payload: Record<string, unknown> = {
        orphanageId,
        classDate,
        photos: photos.map((p, i) => ({
          url: p.url,
          caption: p.caption || null,
          sortOrder: i,
        })),
        photoGps: firstGps,
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

        {/* Photos (required) */}
        <div>
          <label className="block text-sm font-medium text-warmgray-700 mb-1">
            Photos * <span className="text-warmgray-400 font-normal">(at least 1 required)</span>
          </label>

          {/* Photo upload instructions */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-3">
            <p className="text-xs font-medium text-blue-800 mb-1">Photo Guidelines:</p>
            <ul className="text-xs text-blue-700 space-y-0.5 list-disc list-inside">
              <li>Take a group photo of <strong>all students together</strong> in the classroom</li>
              <li>Take the photo <strong>on the day of the class</strong> (not before or after)</li>
              <li>Make sure all students are visible and can be counted</li>
              <li>Include any visible classroom or orphanage signage if possible</li>
              <li>AI will automatically analyze photos to count students and verify location</li>
            </ul>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border border-warmgray-200">
                  <Image
                    src={photo.url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 33vw"
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
                    <span className="absolute bottom-1 left-1 bg-teal-600 text-white text-xs px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="photo-upload"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-dashed border-warmgray-300 px-4 py-3 text-sm text-warmgray-600 hover:border-teal-500 hover:text-teal-600 transition-colors w-full disabled:opacity-50"
            >
              {uploading ? "Uploading..." : photos.length === 0 ? "Upload Photos (required)" : "Add More Photos"}
            </button>
          </div>

          {photos.length === 0 && (
            <p className="text-xs text-warmgray-400 mt-1">
              JPEG, PNG, or WebP. Max 10 MB per file.
            </p>
          )}
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

      {/* AI Photo Analysis Metadata (read-only) */}
      {aiMetadata?.aiAnalyzedAt && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <h3 className="text-sm font-semibold text-purple-900">AI Photo Analysis</h3>
            <span className="text-xs text-purple-500 ml-auto">
              Analyzed {new Date(aiMetadata.aiAnalyzedAt).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-purple-600 mb-3">
            This metadata is automatically generated from uploaded photos and cannot be edited.
            It will update automatically when photos are changed.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <p className="text-xs font-medium text-purple-600">Students Detected</p>
              <p className="text-lg font-bold text-purple-900">
                {aiMetadata.aiKidsCount ?? "N/A"}
              </p>
            </div>

            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <p className="text-xs font-medium text-purple-600">Orphanage Match</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${matchBadgeColor(aiMetadata.aiOrphanageMatch)}`}>
                {aiMetadata.aiOrphanageMatch || "N/A"}
              </span>
            </div>

            {aiMetadata.aiLocation && (
              <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                <p className="text-xs font-medium text-purple-600">Location Cues</p>
                <p className="text-sm text-purple-900 mt-0.5">{aiMetadata.aiLocation}</p>
              </div>
            )}

            {aiMetadata.aiPhotoTimestamp && (
              <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                <p className="text-xs font-medium text-purple-600">Photo Timestamp Cues</p>
                <p className="text-sm text-purple-900 mt-0.5">{aiMetadata.aiPhotoTimestamp}</p>
              </div>
            )}

            {aiMetadata.aiConfidenceNotes && (
              <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                <p className="text-xs font-medium text-purple-600">AI Confidence Notes</p>
                <p className="text-xs text-purple-700 mt-0.5">{aiMetadata.aiConfidenceNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || uploading || !orphanageId || !classDate || photos.length === 0}
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
