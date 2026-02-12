import sharp from "sharp";

const MAX_WIDTH = 1200;
const QUALITY = 80;

export interface GpsCoordinates {
  latitude: number;
  longitude: number;
}

export interface ExifMetadata {
  gps: GpsCoordinates | null;
  dateTaken: string | null; // ISO 8601 string, e.g. "2025-03-12T10:30:00"
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
 * Extract all useful EXIF metadata (GPS + date taken) from an image buffer.
 * Call this BEFORE optimization since sharp strips EXIF data.
 */
export async function extractExifMetadata(
  buffer: Buffer
): Promise<ExifMetadata> {
  try {
    const metadata = await sharp(buffer).metadata();
    const exif = metadata.exif;
    if (!exif) return { gps: null, dateTaken: null };

    return {
      gps: parseGpsFromExifBuffer(exif),
      dateTaken: parseDateFromExifBuffer(exif),
    };
  } catch {
    return { gps: null, dateTaken: null };
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
 * Parse date/time from raw EXIF buffer.
 * EXIF stores dates as "YYYY:MM:DD HH:MM:SS" in DateTimeOriginal or CreateDate tags.
 * Also checks XMP metadata for ISO date strings.
 */
function parseDateFromExifBuffer(exifBuffer: Buffer): string | null {
  try {
    const text = exifBuffer.toString("latin1");

    // EXIF standard format: "2025:03:12 10:30:00" in DateTimeOriginal tag
    // The tag appears in binary EXIF as a string after the tag marker
    const exifDateMatch = text.match(
      /(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/
    );
    if (exifDateMatch) {
      const [, year, month, day, hour, min, sec] = exifDateMatch;
      const isoDate = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
      // Sanity check: year should be reasonable (2000-2099)
      const y = parseInt(year);
      if (y >= 2000 && y <= 2099) {
        return isoDate;
      }
    }

    // XMP format: "2025-03-12T10:30:00" in DateCreated or CreateDate
    const xmpDateMatch = text.match(
      /(?:DateCreated|CreateDate|DateTimeOriginal)[>"=\s]*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/
    );
    if (xmpDateMatch) {
      return xmpDateMatch[1];
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
