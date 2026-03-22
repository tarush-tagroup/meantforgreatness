"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { upload } from "@vercel/blob/client";

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
  aiDateMatch: string | null;
  aiTimeMatch: string | null;
  aiGpsDistance: number | null;
}

interface AttendanceRecord {
  kidId: string | null;
  kidName: string;
  type: "class_member" | "orphanage_guest" | "external";
  note?: string;
}

interface ClassLogFormProps {
  orphanages: { id: string; name: string }[];
  teachers: { id: string; name: string | null; email: string }[];
  currentUserId: string;
  userRole?: "admin" | "teacher_manager";
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
    classDuration?: number | null;
    studentCount: number | null;
    notes: string | null;
    photos?: { url: string; caption: string | null }[];
    attendance?: AttendanceRecord[];
  };
}

/** Safely extract an error message from a fetch Response (handles non-JSON bodies). */
async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json.error || json.message || fallback;
    } catch {
      // Non-JSON response (e.g. "Request Entity Too Large")
      if (res.status === 413) return "File too large. Please use a smaller image (max 10 MB).";
      return text.length > 0 && text.length < 200 ? text : `${fallback} (HTTP ${res.status})`;
    }
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

export default function ClassLogForm({
  orphanages,
  teachers,
  currentUserId,
  userRole,
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
  const [classDuration, setClassDuration] = useState<number>(
    initialData?.classDuration ?? 1.0
  );
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
  // Per-kid notes (kidId → note text)
  const [kidNotes, setKidNotes] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    if (initialData?.attendance) {
      for (const a of initialData.attendance) {
        if (a.kidId && a.note) {
          map.set(a.kidId, a.note);
        }
      }
    }
    return map;
  });

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
    setKidNotes(new Map());
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

  function updateKidNote(kidId: string, note: string) {
    setKidNotes((prev) => {
      const next = new Map(prev);
      if (note) {
        next.set(kidId, note);
      } else {
        next.delete(kidId);
      }
      return next;
    });
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

        // Step 1: Upload raw file directly to Vercel Blob (bypasses 4.5 MB serverless limit)
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload-client",
        });

        // Step 2: Process the upload (extract EXIF, optimize, save to DB)
        const res = await fetch("/api/admin/upload/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawUrl: blob.url }),
        });

        if (!res.ok) {
          const msg = await extractErrorMessage(res, `Failed to process ${file.name}`);
          throw new Error(msg);
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
        const msg = await extractErrorMessage(res, "AI analysis failed");
        throw new Error(msg);
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
        classDuration,
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
            const record: AttendanceRecord = {
              kidId: kid.id,
              kidName: kid.name,
              type: "class_member",
            };
            const note = kidNotes.get(kid.id);
            if (note) record.note = note;
            attendance.push(record);
          }
        }
        // Add selected orphanage guests
        for (const kid of orphanageGuests) {
          if (selectedKidIds.has(kid.id)) {
            const record: AttendanceRecord = {
              kidId: kid.id,
              kidName: kid.name,
              type: "orphanage_guest",
            };
            const note = kidNotes.get(kid.id);
            if (note) record.note = note;
            attendance.push(record);
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
        const msg = await extractErrorMessage(res, "Failed to save");
        throw new Error(msg);
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

      <div className="rounded-lg border border-sand-200 bg-white p-4 sm:p-6 space-y-5">
        {/* Orphanage */}
        <div>
          <label
            htmlFor="orphanageId"
            className="flex items-center gap-2 text-sm font-medium text-sand-700 mb-1"
          >
            Orphanage *
            {isEditing && aiMetadata?.aiAnalyzedAt && (
              aiMetadata.aiGpsDistance != null ? (
                <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  aiMetadata.aiGpsDistance <= 500
                    ? "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20"
                    : "text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20"
                }`}>
                  {aiMetadata.aiGpsDistance <= 500 ? "\u2713" : "\u2717"} {aiMetadata.aiGpsDistance < 1000
                    ? `${Math.round(aiMetadata.aiGpsDistance)}m`
                    : `${(aiMetadata.aiGpsDistance / 1000).toFixed(1)}km`}
                </span>
              ) : (
                <span className="text-[10px] text-sand-400 font-normal">No GPS</span>
              )
            )}
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
            className="flex items-center gap-2 text-sm font-medium text-sand-700 mb-1"
          >
            Class Date *
            {isEditing && aiMetadata?.aiAnalyzedAt && (
              aiMetadata.aiDateMatch && aiMetadata.aiDateMatch !== "no_exif" ? (
                <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  aiMetadata.aiDateMatch === "match"
                    ? "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20"
                    : "text-red-700 bg-red-50 ring-1 ring-inset ring-red-600/20"
                }`}>
                  {aiMetadata.aiDateMatch === "match" ? "\u2713 Verified" : "\u2717 Mismatch"}
                </span>
              ) : (
                <span className="text-[10px] text-sand-400 font-normal">No EXIF</span>
              )
            )}
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
            className="flex items-center gap-2 text-sm font-medium text-sand-700 mb-1"
          >
            Class Time
            {isEditing && aiMetadata?.aiAnalyzedAt && (
              aiMetadata.aiTimeMatch && aiMetadata.aiTimeMatch !== "no_exif" && aiMetadata.aiTimeMatch !== "no_time" ? (
                <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  aiMetadata.aiTimeMatch === "match"
                    ? "text-green-700 bg-green-50 ring-1 ring-inset ring-green-600/20"
                    : "text-amber-700 bg-amber-50 ring-1 ring-inset ring-amber-600/20"
                }`}>
                  {aiMetadata.aiTimeMatch === "match" ? "\u2713 Verified" : "\u2717 Mismatch"}
                </span>
              ) : (
                <span className="text-[10px] text-sand-400 font-normal">No EXIF</span>
              )
            )}
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

        {/* Duration */}
        <div>
          <label
            htmlFor="classDuration"
            className="block text-sm font-medium text-sand-700 mb-1"
          >
            Duration
          </label>
          <select
            id="classDuration"
            value={classDuration}
            onChange={(e) => setClassDuration(parseFloat(e.target.value))}
            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-sand-900"
          >
            <option value={1.0}>1 hour</option>
            <option value={1.5}>1.5 hours</option>
            {userRole === "admin" && (
              <option value={2.0}>2 hours</option>
            )}
          </select>
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
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-green-700">
                      Class Members ({classMembers.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = classMembers.every((k) =>
                          selectedKidIds.has(k.id)
                        );
                        setSelectedKidIds((prev) => {
                          const next = new Set(prev);
                          for (const kid of classMembers) {
                            if (allSelected) {
                              next.delete(kid.id);
                            } else {
                              next.add(kid.id);
                            }
                          }
                          return next;
                        });
                      }}
                      className="text-xs font-medium text-green-600 hover:text-green-800 active:text-green-900 py-1 px-2 -mr-2"
                    >
                      {classMembers.every((k) =>
                        selectedKidIds.has(k.id)
                      )
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {classMembers.map((kid) => (
                      <div key={kid.id}>
                        <label
                          className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-sand-50 active:bg-sand-100 cursor-pointer min-h-[44px]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedKidIds.has(kid.id)}
                            onChange={() => toggleKid(kid.id)}
                            className="h-5 w-5 rounded border-sand-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-sand-900">
                            {kid.name}
                          </span>
                        </label>
                        {selectedKidIds.has(kid.id) && (
                          <input
                            type="text"
                            value={kidNotes.get(kid.id) || ""}
                            onChange={(e) => updateKidNote(kid.id, e.target.value)}
                            placeholder="Add note (optional)"
                            className="ml-10 mr-2 mb-1 w-[calc(100%-3rem)] rounded border border-sand-150 px-2 py-1 text-xs text-sand-700 placeholder:text-sand-400 focus:border-green-300 focus:ring-0"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orphanage Guests */}
              {orphanageGuests.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-blue-700">
                      Other Kids from Orphanage ({orphanageGuests.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = orphanageGuests.every((k) =>
                          selectedKidIds.has(k.id)
                        );
                        setSelectedKidIds((prev) => {
                          const next = new Set(prev);
                          for (const kid of orphanageGuests) {
                            if (allSelected) {
                              next.delete(kid.id);
                            } else {
                              next.add(kid.id);
                            }
                          }
                          return next;
                        });
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 active:text-blue-900 py-1 px-2 -mr-2"
                    >
                      {orphanageGuests.every((k) =>
                        selectedKidIds.has(k.id)
                      )
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {orphanageGuests.map((kid) => (
                      <div key={kid.id}>
                        <label
                          className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-sand-50 active:bg-sand-100 cursor-pointer min-h-[44px]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedKidIds.has(kid.id)}
                            onChange={() => toggleKid(kid.id)}
                            className="h-5 w-5 rounded border-sand-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-sand-900">
                            {kid.name}
                          </span>
                        </label>
                        {selectedKidIds.has(kid.id) && (
                          <input
                            type="text"
                            value={kidNotes.get(kid.id) || ""}
                            onChange={(e) => updateKidNote(kid.id, e.target.value)}
                            placeholder="Add note (optional)"
                            className="ml-10 mr-2 mb-1 w-[calc(100%-3rem)] rounded border border-sand-150 px-2 py-1 text-xs text-sand-700 placeholder:text-sand-400 focus:border-blue-300 focus:ring-0"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* External Kids */}
              <div className="mb-3">
                <p className="text-xs font-medium text-sage-700 mb-2">
                  External Kids (from other orphanages)
                </p>
                {externalKids.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {externalKids.map((name, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 pl-3 pr-1 py-1 text-sm font-medium text-sage-800"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => removeExternalKid(index)}
                          className="flex items-center justify-center w-7 h-7 rounded-full text-sage-500 hover:text-sage-800 active:bg-sage-200"
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
                    placeholder="Enter name"
                    className="min-w-0 flex-1 rounded-lg border border-sand-200 px-3 py-2.5 text-sm text-sand-900"
                  />
                  <button
                    type="button"
                    onClick={addExternalKid}
                    className="shrink-0 rounded-lg bg-sage-100 px-4 py-2.5 text-sm font-medium text-sage-800 hover:bg-sage-200 active:bg-sage-300 transition-colors"
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
          <div className="flex items-center justify-between mb-1">
            <label className="flex items-center gap-2 text-sm font-medium text-sand-700">
              Photos *{" "}
              <span className="text-sand-400 font-normal">
                (at least 1 required)
              </span>
              {isEditing && aiMetadata?.aiAnalyzedAt && aiMetadata.aiKidsCount != null && (
                <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-blue-700 bg-blue-50 ring-1 ring-inset ring-blue-600/20">
                  AI: {aiMetadata.aiKidsCount} kids
                </span>
              )}
            </label>
            {isEditing && photos.length > 0 && (
              <button
                type="button"
                onClick={handleRerunAnalysis}
                disabled={rerunning}
                className="rounded-md bg-white border border-sand-200 px-2.5 py-1 text-xs font-medium text-sand-700 hover:bg-sand-100 transition-colors disabled:opacity-50"
              >
                {rerunning ? "Analyzing..." : "Re-run Analysis"}
              </button>
            )}
          </div>

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
