import type { Bbox } from "./types";

// Interface guardrails only; these are not backend limits or data-resolution claims.
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 100;
export const DEFAULT_RADIUS_KM = 10;
export interface RadiusSelection { lat: number; lon: number; radiusKm: number }
const EARTH_RADIUS_KM = 6371.0088;
const MAX_MAP_LAT = 85.0511;

export function radiusBounds(point: RadiusSelection): { bbox: Bbox; error?: never } | { error: string; bbox?: never } {
  const { lat, lon, radiusKm } = point;
  if (![lat, lon, radiusKm].every(Number.isFinite)) return { error: "Enter a valid center and radius." };
  if (lat < -MAX_MAP_LAT || lat > MAX_MAP_LAT || lon < -180 || lon > 180) return { error: "Center coordinates are outside this map's supported extent." };
  if (radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) return { error: `Radius must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM} km.` };
  // Extrema of a geodesic circle on the same mean-radius sphere used by Leaflet.
  const radians = Math.PI / 180;
  const angularRadius = radiusKm / EARTH_RADIUS_KM;
  const south = lat - angularRadius / radians;
  const north = lat + angularRadius / radians;
  if (south < -MAX_MAP_LAT || north > MAX_MAP_LAT) return { error: "This circle extends beyond the map's latitude limits. Move the center or reduce the radius." };
  const ratio = Math.sin(angularRadius) / Math.cos(lat * radians);
  if (Math.abs(ratio) >= 1) return { error: "This circle crosses a pole. Move the center or reduce the radius." };
  const longitudeRadius = Math.asin(ratio) / radians;
  const west = lon - longitudeRadius, east = lon + longitudeRadius;
  if (west < -180 || east > 180) return { error: "This circle crosses the date line, which the single-box API cannot represent. Move the center or reduce the radius." };
  return { bbox: [west, south, east, north] };
}
