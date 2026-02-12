import sharp from "sharp";

const MAX_WIDTH = 1200;
const QUALITY = 80;

/**
 * Optimize an uploaded image:
 * - Resize to max 1200px width (maintain aspect ratio)
 * - Convert to WebP
 * - Quality 80
 * - Strip EXIF data
 */
export async function optimizeImage(
  buffer: Buffer
): Promise<{ data: Buffer; mimeType: string; width: number; height: number }> {
  const image = sharp(buffer).rotate(); // auto-rotate based on EXIF

  const metadata = await image.metadata();
  const width = metadata.width || MAX_WIDTH;

  const resized = width > MAX_WIDTH ? image.resize(MAX_WIDTH) : image;

  const optimized = await resized
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    data: optimized.data,
    mimeType: "image/webp",
    width: optimized.info.width,
    height: optimized.info.height,
  };
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Validate an uploaded file is an allowed image type and size.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, and WebP images are allowed.";
  }
  if (file.size > MAX_SIZE) {
    return "Image must be less than 10 MB.";
  }
  return null;
}
