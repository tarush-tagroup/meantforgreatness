"use client";

import { useState, useRef, useMemo } from "react";
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
  exifDateTaken?: string | null;
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

interface AttendanceRecord {
  kidId: string | null;
  kidName: string;
  type: "class_member" | "orphanage_guest" | "external";
}

interface ClassLogFormProps {
  orphanages: { id: string; name: string }[];
  teachers: { id: string; name: string | null; email: string }[];
  currentUserId: string;
  classGroups?: { id: string; name: string; orphanageId: string }[];
  allKids?: {
    id: string;
    name: string;
    orphanageId: string | null;
    classGroupId: string | null;
  }[];
  aiMetadata?: AiMetadata | null;
  initialData?: {
    id: string;
    orphanageId: string;
    teacherId: string;
    classGroupId?: string | null;
    classDate: string;
    classTime: string | null;
    studentCount: number | null;
    notes: string | null;
    photos?: { url: string; caption: string | null }[];
    attendance?: AttendanceRecord[];
  };
}

function matchBadgeColor(match: string | null) {
  switch (match) {
    case "high":
      return "bg-green-100 text-green-800";
    case "likely":
      return "bg-green-100 text-green-800";
    case "uncertain":
      return "bg-sage-100 text-sage-800";
    case "unlikely":
      return "bg-red-100 text-red-800";
    default:
      return "bg-sand-100 text-sand-600";
  }
}

export default function ClassLogForm({
  orphanages,
  teachers,
  currentUserId,
  classGroups = [],
  allKids = [],
  aiMetadata,
  initialData,
}: ClassLogFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if this is a legacy entry (editing with no attendance data and no classGroupId)
  const isLegacyEntry =
    isEditing &&
    !initialData.classGroupId &&
    (!initialData.attendance || initialData.attendance.length === 0);

  const [orphanageId, setOrphanageId] = useState(
    initialData?.orphanageId || ""
  );
  const [teacherId, setTeacherId] = useState(
    initialData?.teacherId || currentUserId
  );
  const [classGroupId, setClassGroupId] = useState(
    initialData?.classGroupId || ""
  );
  const [classDate, setClassDate] = useState(
    initialData?.classDate || new Date().toISOString().split("T")[0]
  );
  const [classTime, setClassTime] = useState(initialData?.classTime || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [photos, setPhotos] = useState<PhotoItem[]>(
    initialData?.photos?.map((p) => ({ url: p.url, caption: p.caption })) || []
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState("");

  // Attendance state
  const [selectedKidIds, setSelectedKidIds] = useState<Set<string>>(() => {
    if (initialData?.attendance) {
      return new Set(
        initialData.attendance
          .filter((a) => a.kidId && a.type !== "external")
          .map((a) => a.kidId!)
      );
    }
    return new Set<string>();
  });
  const [externalKids, setExternalKids] = useState<string[]>(() => {
    if (initialData?.attendance) {
      return initialData.attendance
        .filter((a) => a.type === "external")
        .map((a) => a.kidName);
    }
    return [];
  });
  const [newExternalKid, setNewExternalKid] = useState("");
  // Track whether user has interacted with attendance (for auto-selecting class members)
  const [hasInitializedAttendance, setHasInitializedAttendance] = useState(
    !!initialData?.attendance && initialData.attendance.length > 0
  );

  // Filtered class groups for selected orphanage
  const filteredClassGroups = useMemo(
    () => classGroups.filter((g) => g.orphanageId === orphanageId),
    [classGroups, orphanageId]
  );

  // Kids in the selected class group
  const classMembers = useMemo(
    () =>
      classGroupId
        ? allKids.filter((k) => k.classGroupId === classGroupId)
        : [],
    [allKids, classGroupId]
  );

  // Kids in the same orphanage but NOT in the selected class group
  const orphanageGuests = useMemo(
    () =>
      classGroupId && orphanageId
        ? allKids.filter(
            (k) => k.orphanageId === orphanageId && k.classGroupId !== classGroupId
          )
        : [],
    [allKids, orphanageId, classGroupId]
  );

  // Computed student count
  const computedStudentCount = selectedKidIds.size + externalKids.length;

  // Count by type for breakdown
  const classMemberCount = classMembers.filter((k) =>
    selectedKidIds.has(k.id)
  ).length;
  const orphanageGuestCount = orphanageGuests.filter((k) =>
    selectedKidIds.has(k.id)
  ).length;
  const externalCount = externalKids.length;

  function handleOrphanageChange(newOrphanageId: string) {
    setOrphanageId(newOrphanageId);
    setClassGroupId("");
    setSelectedKidIds(new Set());
    setHasInitializedAttendance(false);
  }

  function handleClassGroupChange(newClassGroupId: string) {
    setClassGroupId(newClassGroupId);
    if (!hasInitializedAttendance && newClassGroupId) {
      // Auto-select all class members when first selecting a class group
      const memberIds = allKids
        .filter((k) => k.classGroupId === newClassGroupId)
        .map((k) => k.id);
      setSelectedKidIds(new Set(memberIds));
      setHasInitializedAttendance(true);
    } else if (!newClassGroupId) {
      setSelectedKidIds(new Set());
      setHasInitializedAttendance(false);
    }
  }

  function toggleKid(kidId: string) {
    setSelectedKidIds((prev) => {
      const next = new Set(prev);
      if (next.has(kidId)) {
        next.delete(kidId);
      } else {
        next.add(kidId);
      }
      return next;
    });
  }

  function addExternalKid() {
    const name = newExternalKid.trim();
    if (!name) return;
    setExternalKids((prev) => [...prev, name]);
    setNewExternalKid("");
  }

  function removeExternalKid(index: number) {
    setExternalKids((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setUploading(true);

    try {
      const newPhotos: PhotoItem[] = [];

      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          throw new Error(
            `${file.name}: Only JPEG, PNG, and WebP images are allowed`
          );
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
        newPhotos.push({
          url: data.url,
          caption: null,
          gps: data.gps || null,
          exifDateTaken: data.exifDateTaken || null,
        });
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

  async function handleRerunAnalysis() {
    if (!initialData?.id || photos.length === 0) return;

    setRerunning(true);
    setError("");

    try {
      const firstGps = photos.find((p) => p.gps)?.gps || null;
      const firstExifDate =
        photos.find((p) => p.exifDateTaken)?.exifDateTaken || null;

      const res = await fetch("/api/admin/class-logs/analyze-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classLogId: initialData.id,
          photoUrls: photos.map((p) => p.url),
          photoGps: firstGps,
          exifDateTaken: firstExifDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "AI analysis failed");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis failed");
    } finally {
      setRerunning(false);
    }
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
      const firstGps = photos.find((p) => p.gps)?.gps || null;
      const firstExifDate =
        photos.find((p) => p.exifDateTaken)?.exifDateTaken || null;

      const payload: Record<string, unknown> = {
        orphanageId,
        teacherId,
        classDate,
        photos: photos.map((p, i) => ({
          url: p.url,
          caption: p.caption || null,
          sortOrder: i,
        })),
        photoGps: firstGps,
        exifDateTaken: firstExifDate,
      };
      if (classTime) payload.classTime = classTime;
      if (notes) payload.notes = notes;

      // Include attendance data if we have a class group selected (not legacy)
      if (classGroupId) {
        payload.classGroupId = classGroupId;
        const attendance: AttendanceRecord[] = [];

        // Add selected class members
        for (const kid of classMembers) {
          if (selectedKidIds.has(kid.id)) {
            attendance.push({
              kidId: kid.id,
              kidName: kid.name,
              type: "class_member",
            });
          }
        }
        // Add selected orphanage guests
        for (const kid of orphanageGuests) {
          if (selectedKidIds.has(kid.id)) {
            attendance.push({
              kidId: kid.id,
              kidName: kid.name,
              type: "orphanage_guest",
            });
          }
        }
        // Add external kids
        for (const name of externalKids) {
          attendance.push({
            kidId: null,
            kidName: name,
            type: "external",
          });
        }

        payload.attendance = attendance;
        payload.studentCount = attendance.length;
      } else if (isLegacyEntry) {
        // For legacy entries being re-saved without attendance, keep original studentCount
        payload.studentCount = initialData.studentCount;
      }

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

      <div className="rounded-lg border border-sand-200 bg-white p-6 space-y-5">
        {/* Orphanage */}
        <div>
          <label
            htmlFor="orphanageId"
            className="block text-sm font-medium text-sand-700 mb-1"
          >
            Orphanage *
          </label>
          <select
            id="orphanageId"
            value={orphanageId}
            onChange={(e) => handleOrphanageChange(e.target.value)}
            required
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-900"
          >
            <option value="">Select orphanage</option>
            {orphanages.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        {/* Teacher */}
        <div>
          <label
            htmlFor="teacherId"
            className="block text-sm font-medium text-sand-700 mb-1"
          >
            Teacher *
          </label>
          <select
            id="teacherId"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            required
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-900"
          >
            <option value="">Select teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name || t.email}
                {t.id === currentUserId ? " (you)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Class Group - only show when orphanage is selected */}
        {orphanageId && filteredClassGroups.length > 0 && (
          <div>
            <label
              htmlFor="classGroupId"
              className="block text-sm font-medium text-sand-700 mb-1"
            >
              Class Group {!isLegacyEntry && "*"}
            </label>
            <select
              id="classGroupId"
              value={classGroupId}
              onChange={(e) => handleClassGroupChange(e.target.value)}
              required={!isLegacyEntry}
              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-900"
            >
              <option value="">Select class group</option>
              {filteredClassGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date */}
        <div>
          <label
            htmlFor="classDate"
            className="block text-sm font-medium text-sand-700 mb-1"
          >
            Class Date *
          </label>
          <input
            type="date"
            id="classDate"
            value={classDate}
            onChange={(e) => setClassDate(e.target.value)}
            required
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-900"
          />
        </div>

        {/* Time */}
        <div>
          <label
            htmlFor="classTime"
            className="block text-sm font-medium text-sand-700 mb-1"
          >
            Class Time
          </label>
          <input
            type="text"
            id="classTime"
            value={classTime}
            onChange={(e) => setClassTime(e.target.value)}
            placeholder="e.g. 10:00 AM"
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-900"
          />
        </div>

        {/* Attendance Section - show when class group is selected */}
        {classGroupId && (
          <div className="space-y-4">
            <div className="border-t border-sand-100 pt-4">
              <h3 className="text-sm font-semibold text-sand-800 mb-3">
                Attendance
              </h3>

              {/* Class Members */}
              {classMembers.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-green-700 mb-1.5">
                    Class Members ({classMembers.length})
                  </p>
                  <div className="space-y-1">
                    {classMembers.map((kid) => (
                      <label
                        key={kid.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sand-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKidIds.has(kid.id)}
                          onChange={() => toggleKid(kid.id)}
                          className="rounded border-sand-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-sand-900">
                          {kid.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Orphanage Guests */}
              {orphanageGuests.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-blue-700 mb-1.5">
                    Other Kids from Orphanage ({orphanageGuests.length})
                  </p>
                  <div className="space-y-1">
                    {orphanageGuests.map((kid) => (
                      <label
                        key={kid.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sand-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKidIds.has(kid.id)}
                          onChange={() => toggleKid(kid.id)}
                          className="rounded border-sand-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-sand-900">
                          {kid.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* External Kids */}
              <div className="mb-3">
                <p className="text-xs font-medium text-sage-700 mb-1.5">
                  External Kids (from other orphanages)
                </p>
                {externalKids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {externalKids.map((name, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-800"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => removeExternalKid(index)}
                          className="text-sage-500 hover:text-sage-800"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newExternalKid}
                    onChange={(e) => setNewExternalKid(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addExternalKid();
                      }
                    }}
                    placeholder="Enter name and press Enter"
                    className="flex-1 rounded-lg border border-sand-200 px-3 py-1.5 text-sm text-sand-900"
                  />
                  <button
                    type="button"
                    onClick={addExternalKid}
                    className="rounded-lg bg-sage-100 px-3 py-1.5 text-xs font-medium text-sage-800 hover:bg-sage-200 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-computed Student Count */}
            <div className="rounded-lg bg-sand-50 border border-sand-200 p-3">
              <p className="text-sm font-medium text-sand-700">
                Students Present:{" "}
                <span className="text-lg font-bold text-green-700">
                  {computedStudentCount}
                </span>
              </p>
              {computedStudentCount > 0 && (
                <p className="text-xs text-sand-500 mt-0.5">
                  {classMemberCount > 0 &&
                    `${classMemberCount} from class`}
                  {orphanageGuestCount > 0 &&
                    `${classMemberCount > 0 ? " + " : ""}${orphanageGuestCount} from orphanage`}
                  {externalCount > 0 &&
                    `${classMemberCount > 0 || orphanageGuestCount > 0 ? " + " : ""}${externalCount} external`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Legacy Student Count - show for old entries without attendance */}
        {isLegacyEntry && !classGroupId && (
          <div>
            <label className="block text-sm font-medium text-sand-700 mb-1">
              Students Present
            </label>
            <div className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-600">
              {initialData.studentCount ?? "Not recorded"}
            </div>
            <p className="text-xs text-sand-400 mt-1">
              This is a legacy entry. Select a class group above to use
              attendance tracking.
            </p>
          </div>
        )}

        {/* Photos (required) */}
        <div>
          <label className="block text-sm font-medium text-sand-700 mb-1">
            Photos *{" "}
            <span className="text-sand-400 font-normal">
              (at least 1 required)
            </span>
          </label>

          {/* Photo upload instructions */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-3">
            <p className="text-xs font-medium text-blue-800 mb-1">
              Photo Guidelines:
            </p>
            <ul className="text-xs text-blue-700 space-y-0.5 list-disc list-inside">
              <li>
                Take a group photo of{" "}
                <strong>all students together</strong> in the classroom
              </li>
              <li>
                Take the photo <strong>on the day of the class</strong> (not
                before or after)
              </li>
              <li>
                Make sure all students are visible and can be counted
              </li>
              <li>
                Include any visible classroom or orphanage signage if possible
              </li>
              <li>
                AI will automatically analyze photos to count students and
                verify location
              </li>
            </ul>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="relative group aspect-video rounded-lg overflow-hidden border border-sand-200"
                >
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
                    <span className="absolute bottom-1 left-1 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded">
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
              className="rounded-lg border border-dashed border-sand-300 px-4 py-3 text-sm text-sand-600 hover:border-green-500 hover:text-green-600 transition-colors w-full disabled:opacity-50"
            >
              {uploading
                ? "Uploading..."
                : photos.length === 0
                  ? "Upload Photos (required)"
                  : "Add More Photos"}
            </button>
          </div>

          {photos.length === 0 && (
            <p className="text-xs text-sand-400 mt-1">
              JPEG, PNG, or WebP. Max 10 MB per file.
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-sand-700 mb-1"
          >
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="What was covered in class, observations, etc."
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-900 resize-none"
          />
        </div>
      </div>

      {/* AI Photo Analysis Metadata (read-only) */}
      {isEditing && aiMetadata?.aiAnalyzedAt && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-4 h-4 text-purple-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-purple-900">
              AI Photo Analysis
            </h3>
            <span className="text-xs text-purple-500 ml-auto">
              Analyzed {new Date(aiMetadata.aiAnalyzedAt).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-purple-600 mb-3">
            This metadata is automatically generated from uploaded photos and
            cannot be edited. It will update automatically when photos are
            changed.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <p className="text-xs font-medium text-purple-600">
                Students Detected
              </p>
              <p className="text-lg font-bold text-purple-900">
                {aiMetadata.aiKidsCount ?? "N/A"}
              </p>
            </div>

            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <p className="text-xs font-medium text-purple-600">
                Orphanage Match
              </p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${matchBadgeColor(aiMetadata.aiOrphanageMatch)}`}
              >
                {aiMetadata.aiOrphanageMatch || "N/A"}
              </span>
            </div>

            {aiMetadata.aiLocation && (
              <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                <p className="text-xs font-medium text-purple-600">
                  Location Cues
                </p>
                <p className="text-sm text-purple-900 mt-0.5">
                  {aiMetadata.aiLocation}
                </p>
              </div>
            )}

            {aiMetadata.aiPhotoTimestamp && (
              <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                <p className="text-xs font-medium text-purple-600">
                  Photo Timestamp Cues
                </p>
                <p className="text-sm text-purple-900 mt-0.5">
                  {aiMetadata.aiPhotoTimestamp}
                </p>
              </div>
            )}

            {aiMetadata.aiConfidenceNotes && (
              <div className="bg-white rounded-lg p-3 border border-purple-100 col-span-2">
                <p className="text-xs font-medium text-purple-600">
                  AI Confidence Notes
                </p>
                <p className="text-xs text-purple-700 mt-0.5">
                  {aiMetadata.aiConfidenceNotes}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleRerunAnalysis}
            disabled={rerunning}
            className="mt-3 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
          >
            {rerunning ? "Re-analyzing..." : "Re-run AI Analysis"}
          </button>
        </div>
      )}

      {/* AI analysis pending state */}
      {isEditing && !aiMetadata?.aiAnalyzedAt && photos.length > 0 && (
        <div className="rounded-lg border border-sage-200 bg-sage-50 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-sage-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-sm font-medium text-sage-800">
              AI photo analysis pending
            </p>
          </div>
          <p className="text-xs text-sage-600 mt-1">
            Analysis runs automatically after photos are uploaded. It may take
            a minute to complete.
          </p>
          <button
            type="button"
            onClick={handleRerunAnalysis}
            disabled={rerunning}
            className="mt-2 rounded-lg bg-sage-100 px-3 py-1.5 text-xs font-medium text-sage-800 hover:bg-sage-200 transition-colors disabled:opacity-50"
          >
            {rerunning ? "Analyzing..." : "Run AI Analysis Now"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={
            saving ||
            uploading ||
            !orphanageId ||
            !teacherId ||
            !classDate ||
            photos.length === 0
          }
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving
            ? "Saving..."
            : isEditing
              ? "Update Class Log"
              : "Save Class Log"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/classes")}
          className="rounded-lg border border-sand-200 px-4 py-2 text-sm font-medium text-sand-600 hover:bg-sand-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
