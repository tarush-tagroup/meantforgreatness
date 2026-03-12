import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { put, del } from "@vercel/blob";
import { optimizeImage, extractExifMetadata } from "@/lib/image";
import { db } from "@/db";
import { media } from "@/db/schema";

export const runtime = "nodejs";

/**
 * Post-processing route for client-uploaded images.
 *
 * After the browser uploads a raw image directly to Vercel Blob
 * (via `/api/admin/upload-client`), it calls this endpoint with the
 * raw blob URL. This route:
 *
 * 1. Downloads the raw image from Blob
 * 2. Extracts EXIF metadata (GPS + date taken) before optimization strips it
 * 3. Optimises the image (resize, WebP, quality 80)
 * 4. Uploads the optimised version to Blob
 * 5. Deletes the raw upload to save storage
 * 6. Saves a media record in the database
 *
 * Returns the same shape as `/api/admin/upload`: { url, media, gps, exifDateTaken }
 */
export async function POST(req: NextRequest) {
  const [user, authError] = await withAuth("media:upload");
  if (authError) return authError;

  let rawUrl: string | undefined;

  try {
    const body = await req.json();
    rawUrl = body.rawUrl;
    const orphanageId = (body.orphanageId as string) || null;

    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json(
        { error: "rawUrl is required" },
        { status: 400 }
      );
    }

    // Download the raw image from Vercel Blob
    const fetchRes = await fetch(rawUrl);
    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch uploaded file" },
        { status: 500 }
      );
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract EXIF metadata BEFORE optimization strips it
    const exifData = await extractExifMetadata(buffer);

    // Optimise the image (resize, convert to WebP, strip EXIF)
    const optimized = await optimizeImage(buffer);

    // Generate filename & upload the optimised version
    const filename = `${Date.now()}-optimized.webp`;
    const blob = await put(`images/${filename}`, optimized.data, {
      access: "public",
      contentType: optimized.mimeType,
    });

    // Delete the raw upload to save storage
    try {
      await del(rawUrl);
    } catch {
      // Non-critical — don't fail the request
    }

    // Save metadata in DB
    const [record] = await db
      .insert(media)
      .values({
        url: blob.url,
        filename,
        mimeType: optimized.mimeType,
        sizeBytes: optimized.data.length,
        width: optimized.width,
        height: optimized.height,
        orphanageId,
        uploadedBy: user!.id,
      })
      .returning();

    return NextResponse.json(
      {
        url: blob.url,
        media: record,
        gps: exifData.gps || null,
        exifDateTaken: exifData.dateTaken || null,
      },
      { status: 201 }
    );
  } catch (err) {
    // Try to clean up the raw file if processing fails
    if (rawUrl) {
      try {
        await del(rawUrl);
      } catch {
        // ignore cleanup failure
      }
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
