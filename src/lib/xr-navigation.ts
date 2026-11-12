import { PLACES, type Place } from "./village-places";

export type GroundPosition = [number, number, number];
export const AR_DEFAULT_SCALE = 0.025;
export const SNAP_DEGREES = 30;

export function viewpoint(place: Place): GroundPosition {
  const [x, , z] = place.pos;
  if (place.id.startsWith("bonhomme")) return [x, 0, z + (z > 0 ? 3 : -3)];
  const radius = Math.hypot(x, z);
  if (radius < 0.1) return [0, 0, 6];
  return [x * (radius - 3) / radius, 0, z * (radius - 3) / radius];
}

export function safeLanding(x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) > 12) return false;
  if (Math.hypot(x, z) < 2.8) return false;
  return PLACES.filter(p => p.id !== "grand-sapin").every(p =>
    Math.hypot(x - p.pos[0], z - p.pos[2]) > (p.id.startsWith("bonhomme") ? 1 : 1.8));
}

export function scaleForAR(value: number): number {
  return Number.isFinite(value) ? Math.max(0.015, Math.min(0.05, value)) : AR_DEFAULT_SCALE;
}