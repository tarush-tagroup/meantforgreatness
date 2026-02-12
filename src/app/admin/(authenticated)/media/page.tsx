"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export default function MediaGalleryPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchMedia(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/media?page=${p}&limit=30`);
      if (!res.ok) throw new Error("Failed to load media");
      const data = await res.json();
      setMedia(data.media);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMedia(page);
  }, [page]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError("");
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
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
      }

      // Refresh the list
      await fetchMedia(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-warmgray-900">Media Gallery</h1>
          <p className="mt-1 text-sm text-warmgray-500">
            Upload and manage images
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Images"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-warmgray-200 bg-white p-12 text-center">
          <p className="text-warmgray-500">Loading...</p>
        </div>
      ) : media.length === 0 ? (
        <div className="rounded-lg border border-warmgray-200 bg-white p-12 text-center">
          <p className="text-warmgray-500">No media uploaded yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="group rounded-lg border border-warmgray-200 bg-white overflow-hidden"
              >
                <div className="relative aspect-square">
                  <Image
                    src={item.url}
                    alt={item.filename}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs text-warmgray-600 truncate" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="text-xs text-warmgray-400">
                    {formatBytes(item.sizeBytes)}
                    {item.width && item.height && ` \u00b7 ${item.width}\u00d7${item.height}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-warmgray-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-warmgray-200 px-3 py-1.5 text-sm text-warmgray-600 hover:bg-warmgray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
