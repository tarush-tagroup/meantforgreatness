/**
 * Migration script: Upload orphanage & event images from /public/images/ to Vercel Blob
 * and update the database with the new Blob URLs.
 *
 * This ensures all orphanage and event photos are served from Vercel Blob
 * (backend-managed) instead of hardcoded local file paths.
 *
 * Usage: npx tsx src/db/migrate-images-to-blob.ts
 *
 * Requires: DATABASE_URL, BLOB_READ_WRITE_TOKEN environment variables.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { orphanages, events, eventPhotos } from "./schema";
import { put } from "@vercel/blob";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

const MAX_WIDTH = 1200;
const QUALITY = 80;

async function optimizeAndUpload(
  localPath: string,
  blobName: string
): Promise<string> {
  const fullPath = path.resolve(process.cwd(), "public", localPath.replace(/^\//, ""));

  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠ File not found: ${fullPath}, skipping...`);
    return localPath; // Keep original path if file doesn't exist
  }

  const buffer = fs.readFileSync(fullPath);
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const width = metadata.width || MAX_WIDTH;
  const resized = width > MAX_WIDTH ? image.resize(MAX_WIDTH) : image;
  const optimized = await resized.webp({ quality: QUALITY }).toBuffer();

  const blob = await put(`images/${blobName}.webp`, optimized, {
    access: "public",
    contentType: "image/webp",
  });

  console.log(`  ✓ Uploaded ${localPath} → ${blob.url}`);
  return blob.url;
}

async function migrate() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN environment variable is not set");
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Migrating images from /public/images/ to Vercel Blob...\n");

  // 1. Migrate orphanage images
  console.log("=== Orphanage Images ===");
  const orphanageRows = await db.select().from(orphanages);

  for (const orphanage of orphanageRows) {
    if (
      orphanage.imageUrl &&
      orphanage.imageUrl.startsWith("/images/")
    ) {
      console.log(`Processing: ${orphanage.name} (${orphanage.imageUrl})`);
      const blobUrl = await optimizeAndUpload(
        orphanage.imageUrl,
        `orphanage-${orphanage.id}`
      );

      if (blobUrl !== orphanage.imageUrl) {
        await db
          .update(orphanages)
          .set({ imageUrl: blobUrl, updatedAt: new Date() })
          .where(eq(orphanages.id, orphanage.id));
        console.log(`  ✓ DB updated for ${orphanage.name}`);
      }
    } else {
      console.log(`Skipping ${orphanage.name} — already uses Blob URL or no image`);
    }
  }

  // 2. Migrate event cover images
  console.log("\n=== Event Cover Images ===");
  const eventRows = await db.select().from(events);

  for (const event of eventRows) {
    if (
      event.coverImageUrl &&
      event.coverImageUrl.startsWith("/images/")
    ) {
      console.log(`Processing: ${event.title} cover (${event.coverImageUrl})`);
      const blobUrl = await optimizeAndUpload(
        event.coverImageUrl,
        `event-cover-${event.id}`
      );

      if (blobUrl !== event.coverImageUrl) {
        await db
          .update(events)
          .set({ coverImageUrl: blobUrl, updatedAt: new Date() })
          .where(eq(events.id, event.id));
        console.log(`  ✓ DB updated for event "${event.title}" cover`);
      }
    } else {
      console.log(`Skipping event "${event.title}" cover — already uses Blob URL or no cover`);
    }
  }

  // 3. Migrate event photos
  console.log("\n=== Event Photos ===");
  const photoRows = await db.select().from(eventPhotos);

  for (const photo of photoRows) {
    if (photo.url.startsWith("/images/")) {
      console.log(`Processing: Event photo ${photo.id} (${photo.url})`);
      const baseName = path.basename(photo.url, path.extname(photo.url));
      const blobUrl = await optimizeAndUpload(
        photo.url,
        `event-photo-${baseName}-${photo.id}`
      );

      if (blobUrl !== photo.url) {
        await db
          .update(eventPhotos)
          .set({ url: blobUrl })
          .where(eq(eventPhotos.id, photo.id));
        console.log(`  ✓ DB updated for event photo ${photo.id}`);
      }
    } else {
      console.log(`Skipping event photo ${photo.id} — already uses Blob URL`);
    }
  }

  console.log("\n✅ Image migration complete!");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
