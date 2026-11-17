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

export type Route = { points: XZ[]; loop: boolean };

const segments = (route: Route) => route.points.slice(0, route.loop ? undefined : -1).map((a, i) => [a, route.points[(i + 1) % route.points.length] ?? a] as const);

export function routeLength(route: Route): number {
  return segments(route).reduce((sum, [a, b]) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
}

/** Points every `step` metres along the polyline (the end point is included for an open route). */
export function sampleRoute(route: Route, step = 0.1): XZ[] {
  const result: XZ[] = [];
  let start = 0;
  for (const [a, b] of segments(route)) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let s = Math.ceil(start / step - 1e-9) * step; s < start + length - 1e-9; s += step) {
      const t = (s - start) / length;
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    start += length;
  }
  const last = route.points[route.points.length - 1];
  if (!route.loop && last) result.push([...last]);
  return result;
}

/** A point given as (along, across) in the frame of a ring angle: along the spoke, across toward increasing angle. */
const ringPoint = (angle: number, along: number, across: number): XZ =>
  [along * Math.cos(angle) - across * Math.sin(angle), along * Math.sin(angle) + across * Math.cos(angle)];
const facingOrigin = ([x, z]: XZ) => Math.atan2(-x, -z);
const placeAngle = (id: string) => { const place = PLACES.find(p => p.id === id); return place ? Math.atan2(place.pos[2], place.pos[0]) : 0; };

const toVillage = Math.atan2(-PADDOCK.center[1], -PADDOCK.center[0]);
const paddockPoint = (angle: number, r: number): XZ => [PADDOCK.center[0] + Math.cos(angle) * r, PADDOCK.center[1] + Math.sin(angle) * r];
// 14 slots around the paddock; the two facing the village hold a gate instead of posts.
export const PADDOCK_FENCE: XZ[] = Array.from({ length: 12 }, (_, k) => paddockPoint(toVillage + ((k + 1.5) / 14) * Math.PI * 2, PADDOCK.r));
// 0.7 m from the centre (not 0.9): heads and antlers then keep clear of the trotter on its 1.7 m circle.
const grazing = (side: 1 | -1): XZ => paddockPoint(toVillage + (side > 0 ? 0 : Math.PI), 0.7);
export const REINDEER: { route: Route | null; at: XZ; yaw: number; redNose: boolean }[] = [
  { route: { points: Array.from({ length: 8 }, (_, i) => paddockPoint(toVillage + (i / 8) * Math.PI * 2, PADDOCK.r - 0.8)), loop: true }, at: paddockPoint(toVillage, PADDOCK.r - 0.8), yaw: 0, redNose: true },
  { route: null, at: grazing(1), yaw: -toVillage, redNose: false },
  { route: null, at: grazing(-1), yaw: Math.PI - toVillage, redNose: false },
];

// In front of the Atelier the spoke itself holds the visitor viewpoint (r 6) and the sleigh stop (r 6.5), and the
// parked sleigh (SLEIGH_HOME) sits on its other side: the walking loop runs from the workbench toward the Grand Sapin
// between the snowman and the lamp post, and the workers stand clear of all of them.
const ATELIER = placeAngle("atelier-jouets");
const elfLoop: XZ[] = ([[3.6, -2.15], [3.8, -1.9], [4.4, -1.8], [5.0, -1.9], [5.2, -2.15], [5.0, -2.4], [4.4, -2.5], [3.8, -2.4]] as XZ[]).map(([along, across]) => ringPoint(ATELIER, along, across));
const hammer = ringPoint(ATELIER, 7.2, -1.6), wave = ringPoint(ATELIER, 7.5, 2.2);
export const ELVES: { route: Route | null; at: XZ; yaw: number; task: "walk" | "hammer" | "wave"; seed: number }[] = [
  { route: { points: elfLoop, loop: true }, at: elfLoop[0] ?? [0, 0], yaw: 0, task: "walk", seed: 1 },
  { route: null, at: hammer, yaw: facingOrigin(hammer), task: "hammer", seed: 2 },
  { route: null, at: wave, yaw: facingOrigin(wave), task: "wave", seed: 3 },
];
const santa = ringPoint(placeAngle("poste-pere-noel"), 7.0, 1.7);
export const SANTA: { at: XZ; yaw: number } = { at: santa, yaw: facingOrigin(santa) };

// A figure eight (lemniscate of Gerono) in the lake frame, same rotation convention as insideLake.
const eight: XZ[] = Array.from({ length: 16 }, (_, i) => {
  const t = (i / 16) * Math.PI * 2, lx = 1.6 * Math.sin(t), lz = 0.9 * Math.sin(2 * t);
  const c = Math.cos(LAKE.rotation), s = Math.sin(LAKE.rotation);
  return [LAKE.center[0] + lx * c - lz * s, LAKE.center[1] + lx * s + lz * c];
});
// A quarter loop apart: half a loop would bring both skaters to the crossing at the same instant.
export const SKATERS: { route: Route; phase: number }[] = [{ route: { points: eight, loop: true }, phase: 0 }, { route: { points: eight, loop: true }, phase: 0.25 }];
