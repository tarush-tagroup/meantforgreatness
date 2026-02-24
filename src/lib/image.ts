import sharp from "sharp";
import exifReader from "exif-reader";
import { logger } from "@/lib/logger";

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
 */
export async function extractExifGps(
  buffer: Buffer
): Promise<GpsCoordinates | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    const exif = metadata.exif;
    if (!exif) return null;

    return parseGpsFromExif(exif);
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
    if (!exif) {
      logger.info("exif", "No EXIF buffer found in image");
      return { gps: null, dateTaken: null };
    }

    const gps = parseGpsFromExif(exif);
    const dateTaken = parseDateFromExif(exif);

    logger.info("exif", "EXIF extraction result", {
      hasGps: gps !== null,
      hasDate: dateTaken !== null,
      gpsLat: gps?.latitude,
      gpsLon: gps?.longitude,
      dateTaken,
    });

    return { gps, dateTaken };
  } catch (err) {
    logger.error("exif", "EXIF extraction failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { gps: null, dateTaken: null };
  }
}

/**
 * Parse GPS coordinates from EXIF buffer using exif-reader.
 *
 * Standard EXIF GPS stores coordinates as rational number arrays:
 *   GPSLatitude: [degrees, minutes, seconds]
 *   GPSLatitudeRef: "N" or "S"
 *   GPSLongitude: [degrees, minutes, seconds]
 *   GPSLongitudeRef: "E" or "W"
 *
 * Falls back to regex for XMP-embedded decimal coordinates.
 */
function parseGpsFromExif(exifBuffer: Buffer): GpsCoordinates | null {
  // Method 1: Use exif-reader to properly parse the IFD structure
  try {
    const parsed = exifReader(exifBuffer);
    const gps = parsed?.GPSInfo;

    if (gps) {
      const latArr = gps.GPSLatitude;
      const lonArr = gps.GPSLongitude;
      const latRef = gps.GPSLatitudeRef;
      const lonRef = gps.GPSLongitudeRef;

      if (latArr && lonArr) {
        let lat: number;
        let lon: number;

        if (Array.isArray(latArr) && latArr.length >= 3) {
          // Rational format: [degrees, minutes, seconds]
          lat = latArr[0] + latArr[1] / 60 + latArr[2] / 3600;
          lon = lonArr[0] + lonArr[1] / 60 + lonArr[2] / 3600;
        } else if (typeof latArr === "number") {
          lat = latArr;
          lon = typeof lonArr === "number" ? lonArr : 0;
        } else {
          lat = 0;
          lon = 0;
        }

        // Apply hemisphere reference
        if (latRef === "S" || latRef === "s") lat = -lat;
        if (lonRef === "W" || lonRef === "w") lon = -lon;

        if (lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon)) {
          return { latitude: lat, longitude: lon };
        }
      }
    }
  } catch {
    // exif-reader failed, try regex fallback
  }

  // Method 2: Fallback — regex on raw buffer for XMP decimal GPS
  try {
    const text = exifBuffer.toString("latin1");
    if (!text.includes("GPS")) return null;

    const latMatch = text.match(/GPSLatitude[>"=\s]*(-?\d+(?:\.\d+)?)/);
    const lonMatch = text.match(/GPSLongitude[>"=\s]*(-?\d+(?:\.\d+)?)/);

    if (latMatch && lonMatch) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        return { latitude: lat, longitude: lon };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Parse date/time from EXIF buffer using exif-reader, with regex fallback.
 *
 * exif-reader returns Date objects for DateTimeOriginal, CreateDate, etc.
 * Falls back to regex for raw EXIF date strings and XMP date formats.
 */
function parseDateFromExif(exifBuffer: Buffer): string | null {
  // Method 1: Use exif-reader for proper IFD parsing
  try {
    const parsed = exifReader(exifBuffer);
    const exifData = parsed?.Photo;

    // DateTimeOriginal is the most reliable (when photo was actually taken)
    const dto = exifData?.DateTimeOriginal || exifData?.CreateDate;

    if (dto instanceof Date && !isNaN(dto.getTime())) {
      const y = dto.getFullYear();
      if (y >= 2000 && y <= 2099) {
        // Format as local ISO string (no timezone — matches EXIF convention)
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${y}-${pad(dto.getMonth() + 1)}-${pad(dto.getDate())}T${pad(dto.getHours())}:${pad(dto.getMinutes())}:${pad(dto.getSeconds())}`;
      }
    }
  } catch {
    // exif-reader failed, try regex fallback
  }

  // Method 2: Regex on raw EXIF buffer
  try {
    const text = exifBuffer.toString("latin1");

    // EXIF standard format: "2025:03:12 10:30:00"
    const exifDateMatch = text.match(
      /(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/
    );
    if (exifDateMatch) {
      const [, year, month, day, hour, min, sec] = exifDateMatch;
      const y = parseInt(year);
      if (y >= 2000 && y <= 2099) {
        return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
      }
    }

    // XMP format: "2025-03-12T10:30:00"
    const xmpDateMatch = text.match(
      /(?:DateCreated|CreateDate|DateTimeOriginal)[>"=\s]*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/
    );
    if (xmpDateMatch) {
      return xmpDateMatch[1];
    }
  } catch {
    // ignore
  }

  return null;
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
