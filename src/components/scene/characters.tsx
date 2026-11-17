import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { bipedStep, followRoute, quadrupedKnees, quadrupedLegs, skateLean, startWalker, stridePhase, type BipedStep, type Legs4, type Walker } from "@/lib/gait";
import { ELVES, PADDOCK, PADDOCK_FENCE, REINDEER, routeLength, SANTA, SKATERS, type XZ } from "@/lib/village-props";
import type { Activity } from "../ActivityControls";
import { useWeatherColors } from "../VillageWeather";
import { useMerged, useRadialTexture, type Part } from "./geometry";

/* Characters are rigid parts hung on hidden Object3D skeletons. Each frame the skeletons are posed, then every
 * part's world matrix is copied into one InstancedMesh per part shape, shared by the whole cast: a handful of
 * draw calls for all of them. Colours are per instance, read from the scene tokens. */

type Kind = "sphere" | "cylinder" | "cone" | "box" | "glow";
type V3 = [number, number, number];
type Leaf = { node: THREE.Object3D; kind: Kind; color: string };

const KINDS: Kind[] = ["sphere", "cylinder", "cone", "box", "glow"];
const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const black = () => new THREE.Color();
// Decorative only: clicks and XR rays go through to the scene behind.
const noRaycast = () => undefined;

/** Skeleton builder: joints rotate, leaves are the visible parts (sphere radius 1; cylinder 1 long hanging from its
 *  pivot, radius 1 at the pivot; cone 1 tall standing on its base; unit box). */
function builder() {
  const leaves: Leaf[] = [];
  const v = new THREE.Vector3();
  const joint = (parent: THREE.Object3D, at: V3 = [0, 0, 0]) => { const node = new THREE.Object3D(); node.position.set(...at); parent.add(node); return node; };
  const leaf = (parent: THREE.Object3D, kind: Kind, color: string, at: V3, scale: V3) => {
    const node = joint(parent, at); node.scale.set(...scale); leaves.push({ node, kind, color }); return node;
  };
  const toward = (node: THREE.Object3D, axis: THREE.Vector3, from: V3, to: V3) => {
    v.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const length = v.length(); node.quaternion.setFromUnitVectors(axis, v.normalize()); return length;
  };
  return {
    leaves, joint,
    ball: (parent: THREE.Object3D, color: string, at: V3, r: V3 | number, kind: Kind = "sphere") => leaf(parent, kind, color, at, typeof r === "number" ? [r, r, r] : r),
    block: (parent: THREE.Object3D, color: string, at: V3, size: V3) => leaf(parent, "box", color, at, size),
    seg: (parent: THREE.Object3D, color: string, from: V3, to: V3, r: number) => { const node = leaf(parent, "cylinder", color, from, [r, 1, r]); node.scale.y = toward(node, DOWN, from, to); return node; },
    cone: (parent: THREE.Object3D, color: string, base: V3, tip: V3, r: number) => { const node = leaf(parent, "cone", color, base, [r, 1, r]); node.scale.y = toward(node, UP, base, tip); return node; },
  };
}
type Builder = ReturnType<typeof builder>;

function useKindGeometries(rings: number) {
  const geometries = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 7, rings);
    return { sphere, glow: sphere, cylinder: new THREE.CylinderGeometry(1, 0.85, 1, 6).translate(0, -0.5, 0), cone: new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), box: new THREE.BoxGeometry(1, 1, 1) } satisfies Record<Kind, THREE.BufferGeometry>;
  }, [rings]);
  useEffect(() => () => { for (const kind of KINDS) geometries[kind].dispose(); }, [geometries]);
  return geometries;
}

/** Roots of every mounted character, each with `userData.footprint = [rx, rz]` (metres): CharacterShadows paints
 *  a soft disc under each of them, all characters in one draw call. */
const footprints: THREE.Object3D[] = [];
const MAX_FOOTPRINTS = 16;
const footprint = (root: THREE.Object3D, rx: number, rz = rx) => { root.userData["footprint"] = [rx, rz]; return root; };

/** Painted contact shadows: characters cast no real shadow (budget), these discs keep them on the snow. */
export function CharacterShadows() {
  const colors = useWeatherColors();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const texture = useRadialTexture();
  const disc = useMemo(() => new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), []);
  useEffect(() => () => disc.dispose(), [disc]);
  const object = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = mesh.current; if (!m) return;
    const count = Math.min(footprints.length, MAX_FOOTPRINTS);
    for (let i = 0; i < count; i++) {
      const root = footprints[i]!, size = root.userData["footprint"] as [number, number];
      object.position.set(root.position.x, 0.02, root.position.z); object.rotation.set(0, root.rotation.y, 0); object.scale.set(size[0], 1, size[1]);
      object.updateMatrix(); m.setMatrixAt(i, object.matrix);
    }
    m.count = count; m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[disc, undefined, MAX_FOOTPRINTS]} frustumCulled={false} raycast={noRaycast} renderOrder={1}>
    <meshBasicMaterial map={texture} color={colors["night-sky"] ?? black()} transparent opacity={0.45} depthWrite={false} />
  </instancedMesh>;
}

/** Renders the leaves of posed skeletons; `animate` poses them (dt already clamped to 0.05 s).
 *  Characters never cast shadows: the shadow pass would double their draw calls past the Quest budget. */
function Puppets({ leaves, roots, animate, shadows, rings = 6 }: { leaves: Leaf[]; roots: THREE.Object3D[]; animate: (dt: number, time: number) => void; shadows: boolean; rings?: number }) {
  const colors = useWeatherColors();
  const geometries = useKindGeometries(rings);
  const meshes = useRef<Partial<Record<Kind, THREE.InstancedMesh | null>>>({});
  const { counts, slots } = useMemo(() => {
    const counts: Record<Kind, number> = { sphere: 0, cylinder: 0, cone: 0, box: 0, glow: 0 };
    return { counts, slots: leaves.map(leaf => counts[leaf.kind]++) };
  }, [leaves]);
  useEffect(() => {
    leaves.forEach((leaf, i) => meshes.current[leaf.kind]?.setColorAt(slots[i] ?? 0, colors[leaf.color] ?? black()));
    for (const kind of KINDS) { const color = meshes.current[kind]?.instanceColor; if (color) color.needsUpdate = true; }
  }, [colors, leaves, slots]);
  const time = useRef(0);
  useEffect(() => {
    footprints.push(...roots);
    return () => { for (const root of roots) footprints.splice(footprints.indexOf(root), 1); };
  }, [roots]);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05); time.current += dt;
    animate(dt, time.current);
    for (let i = 0; i < roots.length; i++) roots[i]?.updateMatrixWorld(true);
    for (let i = 0; i < leaves.length; i++) { const leaf = leaves[i]!; meshes.current[leaf.kind]?.setMatrixAt(slots[i] ?? 0, leaf.node.matrixWorld); }
    for (let k = 0; k < KINDS.length; k++) { const mesh = meshes.current[KINDS[k]!]; if (mesh) mesh.instanceMatrix.needsUpdate = true; }
  });
  // Not frustum-culled: instances walk away from any sphere computed once (the single red-nose instance vanished
  // as its trotting reindeer moved), and a few hundred instances cost nothing to submit.
  return <>{KINDS.filter(kind => counts[kind] > 0).map(kind => <instancedMesh key={kind} ref={mesh => { meshes.current[kind] = mesh; }} args={[geometries[kind], undefined, counts[kind]]} receiveShadow={shadows && kind !== "glow"} raycast={noRaycast} frustumCulled={false}>
    {kind === "glow" ? <meshBasicMaterial toneMapped={false} /> : <meshStandardMaterial roughness={0.9} />}
  </instancedMesh>)}</>;
}

/* ---------- Reindeer: 1.5 m at the withers, antlers ≈ 2.1 m; built facing +Z, feet on y = 0. ---------- */

const BODY_Y = 1.12, HIP = 0.97, THIGH = 0.45, CANON = 0.52, NECK = 0.48;

function reindeer(b: Builder, redNose: boolean) {
  const root = new THREE.Object3D();
  const body = b.joint(root, [0, BODY_Y, 0]);
  b.ball(body, "fur", [0, 0, 0], [0.3, 0.3, 0.62]);
  b.ball(body, "fur-light", [0, -0.1, 0.04], [0.25, 0.22, 0.5]);
  const tail = b.joint(body, [0, 0.12, -0.58]);
  b.ball(tail, "fur-light", [0, 0.03, -0.06], [0.07, 0.09, 0.07]);
  const legs = ([[0.17, 0.42], [-0.17, 0.42], [0.17, -0.42], [-0.17, -0.42]] as const).map(([x, z]) => {
    const hip = b.joint(body, [x, HIP - BODY_Y, z]);
    b.seg(hip, "fur", [0, 0, 0], [0, -THIGH, 0], 0.075);
    const knee = b.joint(hip, [0, -THIGH, 0]);
    // Dark lower leg down to the hoof, in one piece.
    b.seg(knee, "bark", [0, 0, 0], [0, -CANON, 0], 0.05);
    return { hip, knee };
  });
  const neck = b.joint(body, [0, 0.05, 0.48]);
  const neckPart = b.seg(neck, "fur", [0, 0, 0], [0, NECK, 0], 0.15);
  const head = b.joint(neck, [0, NECK, 0]);
  b.ball(head, "fur", [0, 0, 0.06], [0.17, 0.17, 0.22]);
  b.ball(head, "fur-light", [0, -0.05, 0.27], [0.11, 0.1, 0.14]);
  b.ball(head, redNose ? "nose" : "bark", [0, -0.02, 0.41], 0.055, redNose ? "glow" : "sphere");
  for (const s of [1, -1]) {
    b.ball(head, "fur", [s * 0.2, 0.1, -0.06], [0.1, 0.035, 0.05]);
    // Two beam segments sweeping up and back, a brow tine forward and a back tine.
    b.seg(head, "antler", [s * 0.07, 0.12, -0.04], [s * 0.22, 0.42, -0.16], 0.03);
    b.seg(head, "antler", [s * 0.22, 0.42, -0.16], [s * 0.2, 0.68, -0.04], 0.025);
    b.seg(head, "antler", [s * 0.14, 0.26, -0.1], [s * 0.16, 0.36, 0.1], 0.02);
    b.seg(head, "antler", [s * 0.22, 0.5, -0.14], [s * 0.36, 0.62, -0.22], 0.02);
  }
  return { root: footprint(root, 0.45, 0.85), body, legs, neck, neckPart, head, tail };
}

/** Height lost by a leg whose thigh swings by `a` (the canon follows at −0.6 a): the body drops so hooves stay on the snow. */
const legDrop = (a: number) => THIGH * (1 - Math.cos(a)) + CANON * (1 - Math.cos(0.4 * a));

export function Herd({ shadows }: { shadows: boolean }) {
  const cast = useMemo(() => {
    const b = builder();
    const rigs = REINDEER.map((deer, i) => {
      const rig = reindeer(b, deer.redNose);
      rig.root.position.set(deer.at[0], 0, deer.at[1]); rig.root.rotation.y = deer.yaw;
      return { ...rig, route: deer.route, walker: deer.route ? startWalker(deer.route) : null, seed: i * 2.1 };
    });
    return { rigs, leaves: b.leaves, roots: rigs.map(r => r.root) };
  }, []);
  const swing = useMemo<Legs4>(() => [0, 0, 0, 0], []), knees = useMemo<Legs4>(() => [0, 0, 0, 0], []);
  const animate = (dt: number, time: number) => {
    for (let r = 0; r < cast.rigs.length; r++) {
      const rig = cast.rigs[r]!;
      let bounce = 0, neck = 0.55, nose = 0, stretch = 0;
      swing.fill(0); knees.fill(0);
      if (rig.walker && rig.route) {
        followRoute(rig.walker, rig.route, 1.1, dt, 3);
        rig.root.position.set(rig.walker.position[0], 0, rig.walker.position[1]); rig.root.rotation.y = rig.walker.yaw;
        const phase = stridePhase(rig.walker.distance, 1.1);
        // The diagonal pair swinging forward bends its knees so the hooves clear the snow.
        quadrupedLegs(phase, 0.45, swing); quadrupedKnees(phase, 0.7, knees); bounce = 0.03 * Math.abs(Math.sin(phase * Math.PI * 2));
        neck += 0.05 * Math.sin(phase * Math.PI * 4);
      } else {
        // Grazing: every 6 s (the two out of step) the neck swings down and stretches 0.22 m and the head tips
        // forward, so the nose comes within 0.1 m of the snow; the short standing neck could not reach it.
        const g = 0.5 - 0.5 * Math.cos((time / 6) * Math.PI * 2 + rig.seed);
        const down = g * g * (3 - 2 * g);
        neck += 2.45 * down; nose = 0.85 * down; stretch = 0.22 * down;
      }
      for (let i = 0; i < 4; i++) { const leg = rig.legs[i]!, a = swing[i]!; leg.hip.rotation.x = a; leg.knee.rotation.x = -0.6 * a + knees[i]!; }
      rig.body.position.y = BODY_Y - legDrop(Math.abs(swing[0])) + bounce;
      rig.neck.rotation.x = neck; rig.head.rotation.x = -neck + 0.15 + nose;
      rig.neckPart.scale.y = NECK + stretch; rig.head.position.y = NECK + stretch;
      rig.tail.rotation.x = 0.2 * Math.sin(time * 9 + rig.seed);
    }
  };
  // 7 × 5 spheres keep a reindeer under 900 triangles (8 spheres × 56 + 17 cylinders × 24 = 856).
  return <Puppets leaves={cast.leaves} roots={cast.roots} animate={animate} shadows={shadows} rings={5} />;
}

export function Paddock({ shadows }: { shadows: boolean }) {
  const colors = useWeatherColors();
  const wood = colors["wood"], snow = colors["snow"];
  // Posts, rails and snow caps in one vertex-coloured mesh: a single draw call for the whole fence.
  const fence = useMerged(() => {
    const paint = (geometry: THREE.BufferGeometry, color = black()) => {
      const count = geometry.getAttribute("position").count;
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: count }, () => [color.r, color.g, color.b]).flat(), 3));
      return geometry;
    };
    const rail = (a: XZ, b: XZ, y: number, pitch = 0): Part => ({ geometry: paint(new THREE.BoxGeometry(0.05, 0.08, Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.1).rotateX(pitch), wood), position: [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], rotation: [0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0] });
    const parts: Part[] = PADDOCK_FENCE.flatMap(([x, z]) => [
      { geometry: paint(new THREE.CylinderGeometry(0.06, 0.075, 1.1, 6), wood), position: [x, 0.55, z] as V3 },
      { geometry: paint(new THREE.SphereGeometry(0.095, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), snow), position: [x, 1.09, z] as V3, scale: [1, 0.8, 1] as V3 },
    ]);
    // Rails close the whole ring: the wider span facing the village is a gate with a diagonal brace.
    PADDOCK_FENCE.forEach((post, i) => { const next = PADDOCK_FENCE[(i + 1) % PADDOCK_FENCE.length] ?? post; parts.push(rail(post, next, 0.45), rail(post, next, 0.9)); });
    const first = PADDOCK_FENCE[0] ?? PADDOCK.center, last = PADDOCK_FENCE[PADDOCK_FENCE.length - 1] ?? PADDOCK.center;
    parts.push(rail(first, last, 0.675, Math.atan2(0.45, Math.hypot(first[0] - last[0], first[1] - last[1]))));
    return parts;
  }, [wood, snow]);
  return <mesh geometry={fence} castShadow={shadows} receiveShadow={shadows} raycast={noRaycast}><meshStandardMaterial vertexColors roughness={0.9} /></mesh>;
}

/* ---------- Bipeds: built 1 unit tall to the top of the head, then scaled (elf 1.1 m, Santa 1.9 m, skater 1.6 m). ---------- */

type Look = { kind: "elf" | "santa" | "skater"; coat: string; legs: string; hat: string; trim: string; hands: string; boots: string; head: number; girth: number };
const HIPS_Y = 0.44, THIGH_B = 0.21, SHIN = 0.235;

function biped(b: Builder, look: Look) {
  const root = new THREE.Object3D();
  const hips = b.joint(root, [0, HIPS_Y, 0]);
  const legs = [1, -1].map(s => {
    const hip = b.joint(hips, [s * 0.07, 0, 0]);
    b.seg(hip, look.legs, [0, 0, 0], [0, -THIGH_B, 0], 0.055);
    const knee = b.joint(hip, [0, -THIGH_B, 0]);
    b.seg(knee, look.legs, [0, 0, 0], [0, -0.19, 0], 0.045);
    b.block(knee, look.boots, [0, -0.205, 0.03], [0.08, 0.06, 0.15]);
    if (look.kind === "skater") b.block(knee, "stone", [0, -SHIN, 0.03], [0.015, 0.02, 0.2]);
    return { hip, knee };
  });
  const chest = b.joint(hips, [0, 0, 0]);
  const g = look.girth;
  b.seg(chest, look.coat, [0, -0.06, 0], [0, 0.32, 0], g);
  b.seg(chest, look.kind === "skater" ? look.coat : "bark", [0, 0.06, 0], [0, 0.01, 0], g * 1.04);
  // Santa: white coat hem; no belt buckle, which kept him 10 triangles over his 700 budget.
  if (look.kind === "santa") b.seg(chest, look.trim, [0, -0.025, 0], [0, -0.075, 0], g * 1.08);
  if (look.kind === "skater") { b.seg(chest, look.trim, [0, 0.36, 0], [0, 0.3, 0], 0.085); b.block(chest, look.trim, [0.05, 0.22, g * 0.95], [0.05, 0.16, 0.02]); }
  const head = b.joint(chest, [0, 0.32, 0]);
  const r = look.head;
  b.ball(head, "skin", [0, r, 0], r);
  for (const s of [1, -1]) b.block(head, "bark", [s * r * 0.36, r * 1.12, r * 0.95], [0.022, 0.03, 0.02]);
  if (look.kind === "elf") {
    b.ball(head, "skin", [0, r * 0.92, r * 0.98], 0.022);
    for (const s of [1, -1]) b.cone(head, "skin", [s * r * 0.9, r, 0], [s * r * 1.65, r * 1.35, -0.03], 0.03);
  }
  if (look.kind === "santa") b.ball(head, look.trim, [0, r * 0.5, r * 0.45], [r * 0.95, r * 0.9, r * 0.65]);
  if (look.kind === "skater") b.ball(head, look.hat, [0, r * 1.2, -0.005], [r * 1.04, r * 0.75, r * 1.04]);
  else {
    b.seg(head, look.trim, [0, r * 1.45, 0], [0, r * 1.75, 0], r * 1.06);
    b.cone(head, look.hat, [0, r * 1.7, 0], look.kind === "santa" ? [0, r * 3.3, -r * 0.9] : [0, r * 3.6, -r * 0.6], r * 0.95);
  }
  b.ball(head, look.trim, look.kind === "skater" ? [0, r * 2, 0] : look.kind === "santa" ? [0, r * 3.3, -r * 0.9] : [0, r * 3.6, -r * 0.6], 0.035);
  const arms = [1, -1].map(s => {
    const shoulder = b.joint(chest, [s * (g + 0.03), 0.29, 0]);
    b.seg(shoulder, look.coat, [0, 0, 0], [0, -0.16, 0], 0.042);
    const elbow = b.joint(shoulder, [0, -0.16, 0]);
    b.seg(elbow, look.coat, [0, 0, 0], [0, -0.14, 0], 0.036);
    b.ball(elbow, look.hands, [0, -0.17, 0], 0.035);
    return { shoulder, elbow };
  });
  return { root, hips, chest, legs, arms };
}
type Biped = ReturnType<typeof biped>;

const LOOKS: Record<string, Look> = {
  walk: { kind: "elf", coat: "green", legs: "red", hat: "green", trim: "snow", hands: "red", boots: "bark", head: 0.13, girth: 0.13 },
  hammer: { kind: "elf", coat: "red", legs: "green", hat: "red", trim: "snow", hands: "green", boots: "bark", head: 0.13, girth: 0.13 },
  wave: { kind: "elf", coat: "green", legs: "snow", hat: "red", trim: "gold", hands: "red", boots: "bark", head: 0.13, girth: 0.13 },
  santa: { kind: "santa", coat: "red", legs: "red", hat: "red", trim: "snow", hands: "snow", boots: "bark", head: 0.105, girth: 0.165 },
  skaterBlue: { kind: "skater", coat: "blue", legs: "bark", hat: "scarf", trim: "gold", hands: "snow", boots: "snow", head: 0.11, girth: 0.12 },
  skaterPlum: { kind: "skater", coat: "plum", legs: "bark", hat: "gold", trim: "scarf", hands: "snow", boots: "snow", head: 0.11, girth: 0.12 },
};

/** Leg pose and the matching hip height so the lower sole stays on the ground. */
function stride(rig: Biped, thighL: number, thighR: number) {
  let reach = 0;
  for (let i = 0; i < rig.legs.length; i++) {
    const leg = rig.legs[i]!, a = i === 0 ? thighL : thighR, bend = 0.8 * Math.max(0, -a);
    leg.hip.rotation.x = a; leg.knee.rotation.x = bend;
    reach = Math.max(reach, THIGH_B * Math.cos(a) + SHIN * Math.cos(a + bend));
  }
  rig.hips.position.y = HIPS_Y - (THIGH_B + SHIN - reach);
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function wave(arm: Biped["arms"][number], time: number, period: number) {
  const s = Math.sin((time / period) * Math.PI * 2);
  arm.shoulder.rotation.set(0, 0, -2.5 + 0.15 * s); arm.elbow.rotation.set(0, 0, -0.35 + 0.35 * s);
}
function rest(rig: Biped) {
  for (let i = 0; i < rig.arms.length; i++) { const arm = rig.arms[i]!; arm.shoulder.rotation.set(0, 0, (i ? -1 : 1) * 0.12); arm.elbow.rotation.set(-0.15, 0, 0); }
}
// Pose buffers shared by every frame: the animation loop allocates nothing.
const step: BipedStep = { thighL: 0, kneeL: 0, thighR: 0, kneeR: 0, drop: 0 };
const glide = { lean: 0, push: 0 };

export function Villagers({ activity, onSanta, shadows }: { activity: Activity; onSanta: () => void; shadows: boolean }) {
  const letter = useRef(activity === "letter");
  letter.current = activity === "letter";
  const cast = useMemo(() => {
    const b = builder();
    const place = (rig: Biped, at: XZ, yaw: number, height: number) => { rig.root.position.set(at[0], 0, at[1]); rig.root.rotation.y = yaw; rig.root.scale.setScalar(height); footprint(rig.root, 0.27 * height); return rig; };
    const elves = ELVES.map(elf => {
      const rig = place(biped(b, LOOKS[elf.task] ?? LOOKS["walk"]!), elf.at, elf.yaw, 1.1);
      if (elf.task === "walk") { b.block(rig.chest, "red", [0, 0.17, 0.27], [0.26, 0.16, 0.16]); b.block(rig.chest, "gold", [0, 0.17, 0.27], [0.04, 0.165, 0.165]); }
      let hammer: THREE.Object3D | null = null;
      if (elf.task === "hammer") {
        b.block(rig.root, "wood", [0, 0.34, 0.36], [0.5, 0.05, 0.28]);
        for (const s of [1, -1]) b.block(rig.root, "wood", [s * 0.21, 0.16, 0.36], [0.05, 0.32, 0.22]);
        b.block(rig.root, "blue", [0.1, 0.4, 0.38], [0.08, 0.08, 0.08]);
        hammer = b.joint(rig.arms[1]!.elbow, [0, -0.17, 0]);
        b.seg(hammer, "wood", [0, 0, -0.03], [0, 0, 0.14], 0.012);
        b.block(hammer, "stone", [0, 0, 0.15], [0.05, 0.05, 0.09]);
      }
      return { rig, task: elf.task, route: elf.route, walker: elf.route ? startWalker(elf.route) : null, seed: elf.seed };
    });
    const santa = place(biped(b, LOOKS["santa"]!), SANTA.at, SANTA.yaw, 1.9);
    const skaters = SKATERS.map((skater, i) => {
      const walker = startWalker(skater.route);
      // Start a fraction of the loop ahead (one call: speed × 0.05 s covers the offset).
      followRoute(walker, skater.route, skater.phase * routeLength(skater.route) / 0.05, 0.05, Infinity);
      walker.distance = 0;
      return { rig: place(biped(b, LOOKS[i ? "skaterPlum" : "skaterBlue"]!), walker.position, walker.yaw, 1.6), route: skater.route, walker, bank: 0 };
    });
    return { elves, santa, skaters, leaves: b.leaves, roots: [...elves.map(e => e.rig.root), santa.root, ...skaters.map(s => s.rig.root)] };
  }, []);
  const animate = (dt: number, time: number) => {
    for (let e = 0; e < cast.elves.length; e++) {
      const elf = cast.elves[e]!, rig = elf.rig;
      if (elf.walker && elf.route) {
        followRoute(elf.walker, elf.route, 0.8, dt, 4);
        rig.root.position.set(elf.walker.position[0], 0, elf.walker.position[1]); rig.root.rotation.y = elf.walker.yaw;
        // Planted foot stays put on the snow: stride 0.55 m in the world is 0.5 in the ×1.1 rig.
        bipedStep(stridePhase(elf.walker.distance, 0.55), 0.55 / 1.1, THIGH_B, SHIN, step);
        const left = rig.legs[0]!, right = rig.legs[1]!;
        left.hip.rotation.x = step.thighL; left.knee.rotation.x = step.kneeL; right.hip.rotation.x = step.thighR; right.knee.rotation.x = step.kneeR;
        rig.hips.position.y = HIPS_Y - step.drop;
        // Both hands hold the gift against the chest.
        for (let i = 0; i < rig.arms.length; i++) { const arm = rig.arms[i]!; arm.shoulder.rotation.set(-0.9, 0, 0); arm.elbow.rotation.set(-0.6, 0, 0); }
        continue;
      }
      stride(rig, 0, 0); rest(rig);
      if (elf.task === "hammer") {
        const hit = Math.pow(0.5 + 0.5 * Math.sin((time / 0.8) * Math.PI * 2), 2);
        const right = rig.arms[1]!; right.shoulder.rotation.set(-0.7 - 0.9 * hit, 0, -0.1); right.elbow.rotation.set(-0.5 - 0.3 * hit, 0, 0);
        rig.chest.rotation.x = 0.12;
      } else wave(rig.arms[1]!, time, 1.4);
    }
    const santa = cast.santa;
    stride(santa, 0, 0); rest(santa);
    const breath = Math.sin((time / 4) * Math.PI * 2);
    santa.chest.scale.set(1 + 0.015 * breath, 1, 1 + 0.02 * breath);
    if (letter.current) wave(santa.arms[1]!, time, 1.2);
    for (let k = 0; k < cast.skaters.length; k++) {
      const skater = cast.skaters[k]!, rig = skater.rig, walker = skater.walker;
      const before = walker.yaw;
      followRoute(walker, skater.route, 1.4, dt, 3);
      // Bank into the turn, smoothed so the polyline corners do not jerk the body.
      const rate = dt > 0 ? wrap(walker.yaw - before) / dt : 0;
      skater.bank += (Math.max(-0.3, Math.min(0.3, -0.25 * rate)) - skater.bank) * Math.min(1, dt * 4);
      rig.root.position.set(walker.position[0], 0, walker.position[1]); rig.root.rotation.set(0, walker.yaw, skater.bank);
      const { lean, push } = skateLean(stridePhase(walker.distance, 2.6), glide);
      for (let i = 0; i < rig.legs.length; i++) { const leg = rig.legs[i]!, out = i === 0 ? Math.max(0, push) : Math.max(0, -push); leg.hip.rotation.set(0.25 * out, 0, (i ? -1 : 1) * 0.35 * out); leg.knee.rotation.set(0.15, 0, 0); }
      rig.hips.position.y = HIPS_Y - 0.01;
      rig.chest.rotation.set(0.3, 0, lean);
      // Arms out ≤ 0.4 rad: hands stay within 0.5 m of the body axis, so the two skaters keep their hands 0.5 m apart.
      for (let i = 0; i < rig.arms.length; i++) { const arm = rig.arms[i]!; arm.shoulder.rotation.set(0.2 * (i ? push : -push), 0, (i ? -1 : 1) * (0.35 + 0.05 * push)); arm.elbow.rotation.set(0, 0, 0); }
    }
  };
  return <>
    <Puppets leaves={cast.leaves} roots={cast.roots} animate={animate} shadows={shadows} />
    {/* Invisible hit volume: Santa opens the letter activity. */}
    <mesh position={[SANTA.at[0], 0.95, SANTA.at[1]]} onClick={event => { event.stopPropagation(); onSanta(); }}>
      <cylinderGeometry args={[0.5, 0.5, 1.9, 8]} /><meshBasicMaterial visible={false} />
    </mesh>
  </>;
}
