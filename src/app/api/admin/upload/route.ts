import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-guard";
import { put } from "@vercel/blob";
import { optimizeImage, validateImageFile } from "@/lib/image";
import { db } from "@/db";
import { media } from "@/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const [user, authError] = await withAuth("media:upload");
  if (authError) return authError;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type and size
  const validationError = validateImageFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // Read file into buffer and optimize
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const optimized = await optimizeImage(buffer);

  // Generate filename: timestamp-original.webp
  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${Date.now()}-${baseName}.webp`;

  // Upload to Vercel Blob
  const blob = await put(`images/${filename}`, optimized.data, {
    access: "public",
    contentType: optimized.mimeType,
  });

  // Save metadata in DB
  const orphanageId = formData.get("orphanageId") as string | null;

  const [record] = await db
    .insert(media)
    .values({
      url: blob.url,
      filename,
      mimeType: optimized.mimeType,
      sizeBytes: optimized.data.length,
      width: optimized.width,
      height: optimized.height,
      orphanageId: orphanageId || null,
      uploadedBy: user!.id,
    })
    .returning();

  return NextResponse.json(
    {
      url: blob.url,
      media: record,
    },
    { status: 201 }
  );
}
