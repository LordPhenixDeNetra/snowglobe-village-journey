import { PLACES } from "./village-places";
import { GIFTS } from "./village-activities";
import type { Ambience } from "./village-weather";
import { Matrix4, Quaternion, Vector3 } from "three";

export type XZ = [number, number];
export type FacadeColor = "red" | "green" | "gold" | "blue" | "plum" | "copper";
export type ChaletVariant = "gable" | "aframe" | "storey";

const FACADES: Record<string, FacadeColor> = { chocolaterie: "red", "atelier-jouets": "green", boulangerie: "gold", "poste-pere-noel": "blue", "boutique-decorations": "plum", "chalet-contes": "copper", "marche-artisans": "red", "ecurie-rennes": "green" };
const VARIANTS: ChaletVariant[] = ["gable", "aframe", "storey"];
const RING = PLACES.filter(place => place.id in FACADES);

export const CHALETS = RING.map((place, i) => ({ id: place.id, variant: VARIANTS[i % 3] ?? "gable", facade: FACADES[place.id] ?? "red", seed: i + 1 }));

// Between the chalets (angles offset by half a step), inside the ring.
export const LAMP_POSTS: XZ[] = Array.from({ length: 8 }, (_, i) => {
  const a = ((i + 0.5) / 8) * Math.PI * 2;
  return [Math.cos(a) * 6.5, Math.sin(a) * 6.5];
});
export const OBSTACLES = LAMP_POSTS.map(([x, z]) => ({ x, z, r: 0.35 }));

// Long axis tangent to the ring, between the Chalet des Contes and the Marché.
const LAKE_CENTER: XZ = [-1.2, -4.4];
export const LAKE = { center: LAKE_CENTER, rx: 2.2, rz: 1.5, rotation: Math.atan2(LAKE_CENTER[1], LAKE_CENTER[0]) + Math.PI / 2 };
export const PADDOCK = { center: [10.3, -10.3] as XZ, r: 2.5 };

// Tiers hug the decoration envelope r = 2.35 − 0.51 (y − 1.2) used by ornaments and garlands:
// each base sits 6 cm outside it and the 0.63 slope ends 6 cm inside before the next tier takes over.
export const TREE_TIERS = [
  { y: 1.0, radius: 2.512, height: 3.987 },
  { y: 2.0, radius: 2.002, height: 3.178 },
  { y: 3.0, radius: 1.492, height: 2.368 },
  { y: 4.0, radius: 0.982, height: 1.559 },
  { y: 5.0, radius: 0.472, height: 1.5 },
];

export function treeRadiusAt(y: number): number {
  return Math.max(0, ...TREE_TIERS.map(tier => y < tier.y ? 0 : tier.radius * (1 - (y - tier.y) / tier.height)));
}

/** `margin` grows both semi-axes (e.g. 0.35 for the snow rim). */
export function insideLake(x: number, z: number, margin = 0): boolean {
  const dx = x - LAKE.center[0], dz = z - LAKE.center[1];
  const c = Math.cos(-LAKE.rotation), s = Math.sin(-LAKE.rotation);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return (lx / (LAKE.rx + margin)) ** 2 + (lz / (LAKE.rz + margin)) ** 2 <= 1;
}

/** Trodden paths: a spoke toward each chalet and the ring 5.6–6.4 m, both interrupted where they would cross the lake. */
export function pathLayout(): { spokes: number[]; arcs: [number, number][] } {
  const clear = (a: number, radii: number[]) => radii.every(r => !insideLake(Math.cos(a) * r, Math.sin(a) * r, 0.4));
  const spokes = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2)
    .filter(a => Array.from({ length: 47 }, (_, k) => 3 + k * 0.1).every(r => clear(a, [r])));
  const steps = 180, arcs: [number, number][] = [];
  let start: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const ok = i < steps && clear(a, [5.6, 6, 6.4]);
    if (ok && start === null) start = a;
    if (!ok && start !== null) { arcs.push([start, a - (Math.PI * 2) / steps - start]); start = null; }
  }
  return { spokes, arcs };
}

/** Deterministic mulberry32 stream: the same seed lays out the same village on every device. */
export function seeded(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ForestPlacement = { x: number; z: number; scale: number; rotation: number };
export function forestPlacements(seed = 11): ForestPlacement[] {
  const random = seeded(seed);
  // The two small trees that hide gifts keep their catalogued positions.
  const trees: ForestPlacement[] = [{ x: -11.3, z: -3, scale: 1.4, rotation: 0 }, { x: 2.5, z: -11.3, scale: 1.4, rotation: 0 }];
  while (trees.length < 82) {
    const a = random() * Math.PI * 2, d = 13 + random() * 8;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - PADDOCK.center[0], z - PADDOCK.center[1]) <= PADDOCK.r) continue;
    if (GIFTS.some(gift => Math.hypot(x - gift.pos[0], z - gift.pos[2]) <= 0.9)) continue;
    trees.push({ x, z, scale: 0.8 + random() * 0.9, rotation: random() * Math.PI * 2 });
  }
  return trees;
}

/** Forest tiers: the lowest skirt starts 0.6 m × scale up so gifts under the small trees stay visible. */
export const FOREST_TIERS = [0, 1, 2].map(tier => ({ y: 1.15 + tier * 0.6, shrink: 1 - tier * 0.27, turn: tier * 0.5 }));
const FOREST_CAP_Y = 1.15 + 2 * 0.6 + 0.32;

/** Instance matrices for the static forest, computed once (trunk 1.2 m and cones 1.1 m tall at scale 1). */
export function forestMatrices(trees = forestPlacements()): { trunks: Matrix4[]; tiers: Matrix4[]; caps: Matrix4[] } {
  const at = (x: number, y: number, z: number, yaw: number, sx: number, sy: number) =>
    new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(sx, sy, sx));
  return {
    trunks: trees.map(t => at(t.x, 0.6 * t.scale, t.z, t.rotation, t.scale, t.scale)),
    tiers: trees.flatMap(t => FOREST_TIERS.map(f => at(t.x, f.y * t.scale, t.z, t.rotation + f.turn, t.scale * f.shrink, t.scale))),
    caps: trees.map(t => at(t.x, FOREST_CAP_Y * t.scale, t.z, t.rotation, t.scale, t.scale)),
  };
}
const UP = new Vector3(0, 1, 0);

/** One cable between each pair of neighbouring chalets, anchored just inside the ring. */
export function garlandSpans(): { from: XZ; to: XZ }[] {
  const anchor = (i: number): XZ => { const a = (i / 8) * Math.PI * 2; return [Math.cos(a) * 8.2, Math.sin(a) * 8.2]; };
  return Array.from({ length: 8 }, (_, i) => ({ from: anchor(i), to: anchor((i + 1) % 8) }));
}

export function lampPoolOpacity(ambience: Ambience): number {
  return ambience === "day" ? 0 : ambience === "dusk" ? 0.45 : 0.9;
}
