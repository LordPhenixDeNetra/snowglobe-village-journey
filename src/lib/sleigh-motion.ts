import { PLACES } from "./village-places";

export type SleighPosition = [number, number, number];
export const SLEIGH_TRAVEL_SECONDS = 4;
export const SLEIGH_HOME: SleighPosition = [2.5, 0.2, 4];
// Peak lift of the flight arc: the sleigh clears the 3.07 m lamp-post heads between neighbouring chalets.
export const SLEIGH_ARC = 3.3;

export function sleighDestination(id: string): SleighPosition | null {
  const place = PLACES.find((p) => p.id === id);
  if (!place) return null;
  const length = Math.hypot(place.pos[0], place.pos[2]);
  if (length < 0.01) return [0, 0.2, 3.5];
  // Park in front of each place rather than inside its building.
  const radius = Math.max(0, length - 2.5);
  return [place.pos[0] / length * radius, 0.2, place.pos[2] / length * radius];
}

export function sleighPosition(from: SleighPosition, to: SleighPosition, progress: number): SleighPosition {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t * t * (3 - 2 * t);
  return [
    from[0] + (to[0] - from[0]) * eased,
    from[1] + (to[1] - from[1]) * eased + Math.sin(Math.PI * t) * SLEIGH_ARC,
    from[2] + (to[2] - from[2]) * eased,
  ];
}