import sharp from "sharp";

const MAX_WIDTH = 1200;
const QUALITY = 80;

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Extract GPS coordinates from image EXIF data before optimization strips it.
 * Returns null if no GPS data is found.
 *
 * Uses sharp metadata to check for EXIF, then parses the raw EXIF buffer
 * looking for GPS rational values or XMP GPS data.
 */
export async function extractExifGps(
  buffer: Buffer
): Promise<GpsCoordinates | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    const exif = metadata.exif;
    if (!exif) return null;

    return parseGpsFromExifBuffer(exif);
  } catch {
    return null;
  }
}

/**
 * Parse GPS coordinates from raw EXIF buffer.
 * Searches for GPS data in XMP metadata strings embedded in the EXIF.
 */
function parseGpsFromExifBuffer(exifBuffer: Buffer): GpsCoordinates | null {
  try {
    const text = exifBuffer.toString("latin1");

    // Check if GPS data exists at all
    if (!text.includes("GPS")) return null;

    // Try to find decimal GPS coordinates in XMP metadata
    const latMatch = text.match(/GPSLatitude[>"=\s]*(-?\d+(?:\.\d+)?)/);
    const lonMatch = text.match(/GPSLongitude[>"=\s]*(-?\d+(?:\.\d+)?)/);

    if (latMatch && lonMatch) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        return { latitude: lat, longitude: lon };
      }
    }

    return null;
  } catch {
    return null;
  }
}

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
