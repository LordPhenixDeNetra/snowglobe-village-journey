import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { forestMatrices, LAKE, pathLayout, seeded, treeRadiusAt, TREE_TIERS } from "@/lib/village-props";
import { TreeDecorations } from "../VillageActivities";
import { useWeatherColors } from "../VillageWeather";
import type { ActivityProps } from "../ActivityControls";
import { box, TWINKLE_STEP, useMerged, type Part } from "./geometry";

const black = () => new THREE.Color();

export function BigTree({ activities, shadows }: { activities: ActivityProps; shadows: boolean }) {
  const colors = useWeatherColors();
  const tiers = (odd: boolean) => TREE_TIERS.filter((_, i) => (i % 2 === 1) === odd).map(tier => ({ geometry: new THREE.ConeGeometry(tier.radius, tier.height, 9), position: [0, tier.y + tier.height / 2, 0] as [number, number, number] }));
  const even = useMerged(() => tiers(false), []);
  const odd = useMerged(() => tiers(true), []);
  const white = useMerged(() => TREE_TIERS.map(tier => ({ geometry: new THREE.ConeGeometry(tier.radius * 0.42, tier.height * 0.42, 9), position: [0, tier.y + tier.height - tier.height * 0.21 + 0.01, 0] as [number, number, number] })), []);
  const lights = useRef<THREE.InstancedMesh>(null);
  const gifts = useRef<THREE.InstancedMesh>(null);
  const bulbs = useMemo(() => {
    const random = seeded(7);
    return Array.from({ length: 60 }, (_, i) => { const y = 1.2 + random() * 4.8; const a = random() * Math.PI * 2; const r = treeRadiusAt(y) * 0.95; return { position: [Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number], color: (["red", "gold", "blue", "snow"] as const)[i % 4] ?? "snow" }; });
  }, []);
  const object = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    const mesh = lights.current; if (!mesh) return;
    bulbs.forEach((bulb, i) => { object.position.set(...bulb.position); object.updateMatrix(); mesh.setMatrixAt(i, object.matrix); mesh.setColorAt(i, colors[bulb.color] ?? black()); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    const base = gifts.current; if (!base) return;
    (["red", "blue", "gold"] as const).forEach((name, i) => { const a = (i / 3) * Math.PI * 2 + 0.4; object.position.set(Math.cos(a) * 1.3, 0.26, Math.sin(a) * 1.3); object.rotation.set(0, a, 0); object.updateMatrix(); base.setMatrixAt(i, object.matrix); base.setColorAt(i, colors[name] ?? black()); });
    base.instanceMatrix.needsUpdate = true; if (base.instanceColor) base.instanceColor.needsUpdate = true;
    base.computeBoundingSphere();
  }, [bulbs, colors, object]);
  const since = useRef(0);
  useFrame(({ clock }, dt) => {
    const mesh = lights.current; since.current += dt; if (!mesh || since.current < TWINKLE_STEP) return;
    since.current = 0;
    const t = clock.elapsedTime;
    bulbs.forEach((bulb, i) => { tint.copy(colors[bulb.color] ?? black()).multiplyScalar(0.55 + 0.45 * Math.sin(t * 3 + i * 1.7)); mesh.setColorAt(i, tint); });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return <group onClick={event => { event.stopPropagation(); activities.onActivity("tree"); }}>
    <mesh position-y={0.6} castShadow={shadows}><cylinderGeometry args={[0.35, 0.45, 1.2, 10]} /><meshStandardMaterial color={colors["bark"] ?? black()} roughness={0.95} /></mesh>
    <mesh geometry={even} castShadow={shadows} receiveShadow><meshStandardMaterial color={colors["needle"] ?? black()} roughness={0.9} flatShading /></mesh>
    <mesh geometry={odd} castShadow={shadows} receiveShadow><meshStandardMaterial color={colors["needle-dark"] ?? black()} roughness={0.9} flatShading /></mesh>
    <mesh geometry={white}><meshStandardMaterial color={colors["snow"] ?? black()} roughness={1} flatShading /></mesh>
    <instancedMesh ref={lights} args={[undefined, undefined, 60]}><sphereGeometry args={[0.07, 6, 6]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={gifts} args={[undefined, undefined, 3]} castShadow={shadows}><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial roughness={0.5} /></instancedMesh>
    <TreeDecorations decoration={activities.decoration} />
    <pointLight position={[0, 4, 0]} intensity={8} distance={10} color={colors["lantern"] ?? black()} />
  </group>;
}

// Decorative only: no raycast, so XR rays and clicks reach the gift hidden under a tree.
const noRaycast = () => undefined;

/** Static instanced mesh filled once (drei <Instances> would recompose every matrix each frame). */
function StaticInstances({ matrices, shadows, children }: { matrices: THREE.Matrix4[]; shadows: boolean; children: React.ReactNode }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const m = mesh.current; if (!m) return;
    matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix));
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [matrices]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, matrices.length]} castShadow={shadows} receiveShadow raycast={noRaycast}>{children}</instancedMesh>;
}

export function Forest({ shadows }: { shadows: boolean }) {
  const colors = useWeatherColors();
  const { trunks, tiers, caps } = useMemo(() => forestMatrices(), []);
  return <>
    <StaticInstances matrices={trunks} shadows={shadows}><cylinderGeometry args={[0.12, 0.17, 1.2, 7]} /><meshStandardMaterial color={colors["bark"] ?? black()} roughness={0.95} /></StaticInstances>
    <StaticInstances matrices={tiers} shadows={shadows}><coneGeometry args={[0.95, 1.1, 8]} /><meshStandardMaterial color={colors["needle"] ?? black()} roughness={0.9} flatShading /></StaticInstances>
    <StaticInstances matrices={caps} shadows={false}><coneGeometry args={[0.42, 0.5, 8]} /><meshStandardMaterial color={colors["snow"] ?? black()} roughness={1} flatShading /></StaticInstances>
  </>;
}

export function Snowman({ position, shadows, seed }: { position: [number, number, number]; shadows: boolean; seed: number }) {
  const colors = useWeatherColors();
  const random = useMemo(() => seeded(seed), [seed]);
  const tilt = useMemo(() => (random() - 0.5) * 0.3, [random]);
  const side = useMemo(() => (random() < 0.5 ? -1 : 1), [random]);
  const white = useMerged(() => [
    { geometry: new THREE.SphereGeometry(0.55, 18, 14), position: [0, 0.5, 0] },
    { geometry: new THREE.SphereGeometry(0.4, 16, 12), position: [0, 1.2, 0] },
    { geometry: new THREE.SphereGeometry(0.3, 16, 12), position: [0, 1.74, 0] },
  ], []);
  const dark = useMerged(() => {
    const parts: Part[] = [
      { geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 12), position: [0, 2.12, 0], rotation: [0, 0, tilt] },
      { geometry: new THREE.CylinderGeometry(0.33, 0.33, 0.05, 12), position: [0, 1.95, 0], rotation: [0, 0, tilt] },
      { geometry: new THREE.CylinderGeometry(0.025, 0.018, 0.7, 5), position: [-0.55, 1.4, 0], rotation: [0, 0, 1.1] },
      { geometry: new THREE.CylinderGeometry(0.025, 0.018, 0.7, 5), position: [0.55, 1.4, 0], rotation: [0, 0, -1.1] },
    ];
    for (const [x, y, z] of [[-0.1, 1.82, 0.26], [0.1, 1.82, 0.26], [0, 1.32, 0.37], [0, 1.18, 0.39], [0, 1.04, 0.37]] as const) parts.push({ geometry: new THREE.SphereGeometry(y > 1.5 ? 0.04 : 0.05, 8, 6), position: [x, y, z] });
    for (let i = 0; i < 5; i++) { const a = -0.6 + i * 0.3; parts.push({ geometry: new THREE.SphereGeometry(0.025, 6, 5), position: [Math.sin(a) * 0.17, 1.6 + Math.cos(a) * 0.05 - 0.02, 0.27] }); }
    return parts;
  }, [tilt]);
  const scarf = useMerged(() => [
    { geometry: new THREE.TorusGeometry(0.3, 0.07, 8, 18), position: [0, 1.47, 0], rotation: [Math.PI / 2, 0, 0] },
    { geometry: box(0.14, 0.42, 0.06, 0.02), position: [side * 0.2, 1.26, 0.33], rotation: [0, 0, side * 0.2] },
  ], [side]);
  return <group position={position}>
    <mesh geometry={white} castShadow={shadows} receiveShadow><meshStandardMaterial color={colors["snow"] ?? black()} roughness={0.95} /></mesh>
    <mesh geometry={dark} castShadow={shadows}><meshStandardMaterial color={colors["bark"] ?? black()} roughness={0.9} /></mesh>
    <mesh geometry={scarf}><meshStandardMaterial color={colors["scarf"] ?? black()} roughness={0.9} /></mesh>
    <mesh position={[0, 1.74, 0.42]} rotation-x={Math.PI / 2}><coneGeometry args={[0.05, 0.3, 8]} /><meshStandardMaterial color={colors["copper"] ?? black()} roughness={0.8} /></mesh>
  </group>;
}

/** Polar grid disc with a height function: CircleGeometry has no interior vertices to displace. */
function disc(radius: number, rings: number, segments: number, height: (x: number, z: number) => number): THREE.BufferGeometry {
  const positions: number[] = [0, height(0, 0), 0];
  const index: number[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const r = (ring / rings) * radius;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      positions.push(x, height(x, z), z);
    }
  }
  const at = (ring: number, s: number) => ring === 0 ? 0 : 1 + (ring - 1) * segments + (s % segments);
  for (let s = 0; s < segments; s++) index.push(at(0, 0), at(1, s + 1), at(1, s));
  for (let ring = 1; ring < rings; ring++) for (let s = 0; s < segments; s++) {
    index.push(at(ring, s), at(ring, s + 1), at(ring + 1, s), at(ring, s + 1), at(ring + 1, s + 1), at(ring + 1, s));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// Flat inside the walking radius; gentle drifts beyond it toward the forest.
const relief = (x: number, z: number) => {
  const r = Math.hypot(x, z);
  const blend = Math.min(1, Math.max(0, r - 12));
  return 0.15 * (0.5 + 0.5 * Math.sin(x * 0.7) * Math.cos(z * 0.6)) * blend * blend * (3 - 2 * blend);
};

export function Ground({ radius, shadows, sparkles }: { radius: number; shadows: boolean; sparkles: boolean }) {
  const colors = useWeatherColors();
  const snow = useMemo(() => disc(radius, 28, 72, relief), [radius]);
  useEffect(() => () => snow.dispose(), [snow]);
  // Trodden paths: a ring between the tree and the chalets and a spoke toward each chalet, both skirting the lake.
  const paths = useMerged(() => {
    const { spokes, arcs } = pathLayout();
    // RingGeometry lies in XY; after rotateX(−π/2) an angle θ maps to (cos θ, −sin θ), so arcs start at −(start + length).
    const parts: Part[] = arcs.map(([start, length]) => ({ geometry: new THREE.RingGeometry(5.6, 6.4, Math.max(4, Math.round(length * 12)), 1, -(start + length), length), rotation: [-Math.PI / 2, 0, 0] }));
    for (const a of spokes) parts.push({ geometry: new THREE.PlaneGeometry(0.7, 4.6), position: [Math.cos(a) * 5.3, 0, Math.sin(a) * 5.3], rotation: [-Math.PI / 2, 0, -a + Math.PI / 2] });
    return parts;
  }, []);
  return <>
    <mesh geometry={snow} receiveShadow={shadows}><meshStandardMaterial color={colors["snow"] ?? black()} roughness={1} /></mesh>
    <mesh geometry={paths} position-y={0.01} receiveShadow={shadows}><meshStandardMaterial color={colors["path"] ?? black()} roughness={1} polygonOffset polygonOffsetFactor={-1} /></mesh>
    {/* drei Sparkles size points in screen space, ignoring the AR miniature scale: desktop and VR only. */}
    {sparkles && <Sparkles count={600} scale={[30, 0.3, 30]} position-y={0.1} size={1.6} speed={0.15} opacity={0.7} color={colors["snow"] ?? black()} />}
  </>;
}

export function Lake({ shadows }: { shadows: boolean }) {
  const colors = useWeatherColors();
  const ellipse = (rx: number, rz: number) => new THREE.ShapeGeometry(new THREE.Shape().absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0), 40);
  const ice = useMemo(() => ellipse(LAKE.rx, LAKE.rz).rotateX(-Math.PI / 2), []);
  useEffect(() => () => ice.dispose(), [ice]);
  const rim = useMerged(() => {
    const parts: Part[] = [{ geometry: ellipse(LAKE.rx + 0.35, LAKE.rz + 0.35), rotation: [-Math.PI / 2, 0, 0] }];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      parts.push({ geometry: new THREE.SphereGeometry(1, 10, 7), position: [Math.cos(a) * (LAKE.rx + 0.2), 0, Math.sin(a) * (LAKE.rz + 0.2)], scale: [0.55, 0.2, 0.45] });
    }
    return parts;
  }, []);
  return <group position={[LAKE.center[0], 0, LAKE.center[1]]} rotation-y={-LAKE.rotation}>
    <mesh geometry={rim} position-y={0.008} receiveShadow={shadows}><meshStandardMaterial color={colors["snow"] ?? black()} roughness={1} /></mesh>
    <mesh geometry={ice} position-y={0.014} receiveShadow={shadows}><meshStandardMaterial color={colors["ice"] ?? black()} roughness={0.15} metalness={0.1} envMapIntensity={0.6} /></mesh>
  </group>;
}
