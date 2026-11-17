import type { Route, XZ } from "./village-props";

/** Route-follower state. `followRoute` updates it in place (no per-frame allocation) and returns it. */
export type Walker = {
  distance: number;
  segment: number;
  along: number;
  position: XZ;
  yaw: number;
  forward: 1 | -1;
};

const MAX_DT = 0.05;
const TAU = Math.PI * 2;

const segmentCount = (route: Route) =>
  Math.max(1, route.loop ? route.points.length : route.points.length - 1);
const endpoints = (route: Route, i: number): [XZ, XZ] => {
  const a = route.points[i] ?? [0, 0];
  return [a, route.points[(i + 1) % route.points.length] ?? a];
};

/** At the first point, facing the second (models look down +Z: yaw = atan2(dx, dz)). */
export function startWalker(route: Route): Walker {
  const [a, b] = endpoints(route, 0);
  return {
    distance: 0,
    segment: 0,
    along: 0,
    position: [a[0], a[1]],
    yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
    forward: 1,
  };
}

export function followRoute(
  w: Walker,
  route: Route,
  speed: number,
  dt: number,
  maxYawRate: number,
): Walker {
  const step = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, MAX_DT));
  let left = Math.max(0, speed) * step;
  w.distance += left;
  const count = segmentCount(route);
  // Bounded: a route cannot hold more than a few segment hops per frame at walking speeds.
  for (let guard = 0; guard < 64; guard++) {
    const [a, b] = endpoints(route, w.segment);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const room = w.forward > 0 ? length - w.along : w.along;
    if (left <= room || (length === 0 && count === 1)) {
      w.along += w.forward * Math.min(left, room);
      break;
    }
    left -= room;
    if (w.forward > 0) {
      if (w.segment + 1 < count) {
        w.segment++;
        w.along = 0;
      } else if (route.loop) {
        w.segment = 0;
        w.along = 0;
      } else {
        w.forward = -1;
        w.along = length;
      }
    } else if (w.segment > 0) {
      w.segment--;
      const [c, d] = endpoints(route, w.segment);
      w.along = Math.hypot(d[0] - c[0], d[1] - c[1]);
    } else {
      w.forward = 1;
      w.along = 0;
    }
  }
  const [a, b] = endpoints(route, w.segment);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const t = w.along / length;
  w.position[0] = a[0] + (b[0] - a[0]) * t;
  w.position[1] = a[1] + (b[1] - a[1]) * t;
  const target = Math.atan2((b[0] - a[0]) * w.forward, (b[1] - a[1]) * w.forward);
  const delta = Math.atan2(Math.sin(target - w.yaw), Math.cos(target - w.yaw));
  const turn = maxYawRate * step;
  w.yaw += Math.max(-turn, Math.min(turn, delta));
  return w;
}

/** Fraction of the stride cycle in [0, 1): it advances with distance, so feet never slide when speed changes. */
export function stridePhase(distance: number, strideM: number): number {
  const phase = (distance / strideM) % 1;
  return phase < 0 ? phase + 1 : phase;
}

export type Legs4 = [number, number, number, number];

/* Every pose function takes an optional `out` filled in place: the animation loops pass their own buffers and
 * allocate nothing per frame; without it a fresh result is returned. */

/** Thigh swing angles [front-left, front-right, hind-left, hind-right]: diagonal pairs move together (trot). */
export function quadrupedLegs(phase: number, amplitude: number, out: Legs4 = [0, 0, 0, 0]): Legs4 {
  const swing = amplitude * Math.sin(phase * TAU);
  out[0] = swing;
  out[1] = -swing;
  out[2] = -swing;
  out[3] = swing;
  return out;
}

/** Knee flexion matching `quadrupedLegs`: a leg bends (hoof lifted) only while its thigh swings forward, i.e. while
 *  its angle decreases (positive angles point the hoof backward), and stays straight while it pushes back. */
export function quadrupedKnees(phase: number, lift: number, out: Legs4 = [0, 0, 0, 0]): Legs4 {
  const c = Math.cos(phase * TAU);
  const first = lift * Math.max(0, -c),
    second = lift * Math.max(0, c);
  out[0] = first;
  out[1] = second;
  out[2] = second;
  out[3] = first;
  return out;
}

export type BipedStep = {
  thighL: number;
  kneeL: number;
  thighR: number;
  kneeR: number;
  drop: number;
};

/** One leg over its own cycle u ∈ [0, 1): stance (straight, planted) for the first half, swing (knee bent) after.
 *  During stance sin(thigh) = (u − 0.25)·stride / leg, so the foot stays put while the hips advance stride/2. */
function legThigh(u: number, stride: number, length: number): number {
  if (u < 0.5) return Math.asin(((u - 0.25) * stride) / length);
  return Math.asin(Math.min(1, stride / (4 * length))) * Math.cos((Math.PI * (u - 0.5)) / 0.5);
}
// Bend the knee only while the thigh is still behind: bending it once the thigh points forward would
// lengthen the leg and drag the foot through the snow before it lands.
function legKnee(u: number): number {
  const t = (u - 0.5) / 0.5;
  return u >= 0.5 && t < 0.5 ? 0.9 * Math.sin(2 * Math.PI * t) : 0;
}
const frac = (v: number) => v - Math.floor(v);

/** Walking legs for a stride (same units as the legs); `drop` lowers the hips so the stance sole stays on the ground.
 *  Positive thigh/knee angles swing the foot backward (rotation about +X for a rig facing +Z). */
export function bipedStep(
  phase: number,
  stride: number,
  thigh: number,
  shin: number,
  out: BipedStep = { thighL: 0, kneeL: 0, thighR: 0, kneeR: 0, drop: 0 },
): BipedStep {
  const length = thigh + shin,
    uL = frac(phase + 0.25),
    uR = frac(phase + 0.75);
  out.thighL = legThigh(uL, stride, length);
  out.kneeL = legKnee(uL);
  out.thighR = legThigh(uR, stride, length);
  out.kneeR = legKnee(uR);
  const reachL = thigh * Math.cos(out.thighL) + shin * Math.cos(out.thighL + out.kneeL);
  const reachR = thigh * Math.cos(out.thighR) + shin * Math.cos(out.thighR + out.kneeR);
  out.drop = length - Math.max(reachL, reachR);
  return out;
}

export type BipedLimbs = { legL: number; legR: number; armL: number; armR: number };

/** Each arm swings against the leg on its own side. */
export function bipedLimbs(
  phase: number,
  amplitude: number,
  out: BipedLimbs = { legL: 0, legR: 0, armL: 0, armR: 0 },
): BipedLimbs {
  const swing = amplitude * Math.sin(phase * TAU);
  out.legL = swing;
  out.legR = -swing;
  out.armL = -swing * 0.8;
  out.armR = swing * 0.8;
  return out;
}

/** Skating glide: the body leans ±0.15 rad over the gliding leg while the other one pushes (push > 0: left leg). */
export function skateLean(
  phase: number,
  out: { lean: number; push: number } = { lean: 0, push: 0 },
): { lean: number; push: number } {
  const s = Math.sin(phase * TAU);
  out.lean = 0.15 * s;
  out.push = s;
  return out;
}
