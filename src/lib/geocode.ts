import { logger } from "@/lib/logger";

/**
 * Geocode an address to lat/long using OpenStreetMap Nominatim (free, no API key).
 * Falls back gracefully — returns null if geocoding fails.
 */
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

/**
 * Geocode an address string to latitude/longitude coordinates.
 * Uses OpenStreetMap Nominatim API (free, no key required).
 * Returns null if the address cannot be geocoded.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult | null> {
  if (!address || address.trim().length === 0) return null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "MeantForGreatness/1.0 (admin orphanage geocoding)",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const result = data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    if (isNaN(latitude) || isNaN(longitude)) return null;

    return {
      latitude,
      longitude,
      displayName: result.display_name || address,
    };
  } catch {
    logger.warn("geocode", "Geocoding failed for address", { address });
    return null;
  }
}

/**
 * Calculate the distance in meters between two GPS coordinates
 * using the Haversine formula.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if two GPS coordinates are within a given distance threshold.
 * Default threshold: 200 meters.
 */
export function isWithinDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  thresholdMeters: number = 200
): boolean {
  return haversineDistance(lat1, lon1, lat2, lon2) <= thresholdMeters;
}
