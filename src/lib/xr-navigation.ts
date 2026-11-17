import { PLACES, type Place } from "./village-places";
import { OBSTACLES } from "./village-props";

export type GroundPosition = [number, number, number];
export const AR_DEFAULT_SCALE = 0.025;
export const SNAP_DEGREES = 30;
// World units are metres in VR; AR alone scales the village down.
export const VR_WORLD_SCALE = 1;
export const WALK_SPEED = 1.2;
export const WALK_RESPONSE = 8;
export const WALK_MAX_DELTA = 0.05;
export const AR_ROTATION_STEP = Math.PI / 12;

export function horizontalHit(matrix: readonly number[]): boolean {
  return matrix.length === 16 && matrix.every(Number.isFinite) && (matrix[5] ?? 0) >= 0.9;
}

export function controllerTurn(axis: number, smooth: boolean, armed: boolean, delta: number): { angle: number; armed: boolean } {
  if (!Number.isFinite(axis) || Math.abs(axis) < 0.5) return { angle: 0, armed: true };
  const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, WALK_MAX_DELTA));
  return { angle: smooth ? -Math.sign(axis) * dt : armed ? -Math.sign(axis) * SNAP_DEGREES * Math.PI / 180 : 0, armed: smooth ? true : false };
}

export type WalkVelocity = { x: number; z: number };

export function walkingTarget(stickX: number, stickY: number, forward: WalkVelocity): WalkVelocity {
  const magnitude = Math.hypot(stickX, stickY);
  const facing = Math.hypot(forward.x, forward.z);
  if (!Number.isFinite(magnitude) || magnitude <= 0.15 || facing < 0.001) return { x: 0, z: 0 };
  const speed = WALK_SPEED * Math.min(1, (magnitude - 0.15) / 0.85);
  const x = stickX / magnitude * speed;
  const y = stickY / magnitude * speed;
  return { x: (-forward.z * x - forward.x * y) / facing, z: (forward.x * x - forward.z * y) / facing };
}

export function walkingVelocity(current: WalkVelocity, target: WalkVelocity, delta: number): WalkVelocity {
  const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, WALK_MAX_DELTA));
  const blend = 1 - Math.exp(-WALK_RESPONSE * dt);
  return { x: current.x + (target.x - current.x) * blend, z: current.z + (target.z - current.z) * blend };
}

export function walkOnGround(position: GroundPosition, velocity: WalkVelocity, delta: number): GroundPosition {
  const dt = Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, WALK_MAX_DELTA));
  let [x, , z] = position;
  const nextX = x + velocity.x * dt;
  if (safeLanding(nextX, z)) x = nextX;
  const nextZ = z + velocity.z * dt;
  if (safeLanding(x, nextZ)) z = nextZ;
  return [x, 0, z];
}

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
  if (!OBSTACLES.every(o => Math.hypot(x - o.x, z - o.z) > o.r)) return false;
  return PLACES.filter(p => p.id !== "grand-sapin").every(p =>
    Math.hypot(x - p.pos[0], z - p.pos[2]) > (p.id.startsWith("bonhomme") ? 1 : 1.8));
}

export function scaleForAR(value: number): number {
  return Number.isFinite(value) ? Math.max(0.015, Math.min(0.05, value)) : AR_DEFAULT_SCALE;
}