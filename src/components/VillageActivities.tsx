import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GIFTS, huntComplete, ornamentPosition, type Decoration } from "@/lib/village-activities";
import { PLACES } from "@/lib/village-places";
import { useWeatherColors } from "./VillageWeather";
import { useMerged } from "./scene/geometry";
import type { ActivityProps } from "./ActivityControls";

export function TreeDecorations({ decoration }: { decoration: Decoration }) {
  const colors = useWeatherColors();
  const star = useRef<THREE.Mesh>(null);
  const garlands = useMemo(() => Array.from({ length: decoration.garlands }, (_, n) => {
    const points = Array.from({ length: 100 }, (_, i) => { const t = i / 99; const y = 1.2 + n * 1.15 + t * 0.7; const r = 2.35 - (y - 1.2) * 0.51; const a = t * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 100, 0.045, 5, false);
  }), [decoration.garlands]);
  useEffect(() => () => garlands.forEach(geometry => geometry.dispose()), [garlands]);
  useFrame(({ clock }) => {
    if (!star.current) return;
    const t = clock.elapsedTime;
    const material = star.current.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = decoration.star === "steady" ? 2 : decoration.star === "pulse" ? 1.8 + Math.sin(t * 2) * 1.2 : 1 + Math.pow(Math.sin(t * 7), 8) * 4;
    star.current.rotation.y = decoration.star === "steady" ? 0 : t * 0.25;
  });
  return <group>
    {decoration.ornaments.map((color, i) => <mesh key={i} position={ornamentPosition(i)}><sphereGeometry args={[0.15, 12, 12]} /><meshStandardMaterial color={(colors[color] ?? new THREE.Color())} metalness={0.6} roughness={0.23} emissive={(colors[color] ?? new THREE.Color())} emissiveIntensity={0.3} /></mesh>)}
    {garlands.map((geometry, i) => <mesh key={i} geometry={geometry}><meshStandardMaterial color={(colors["gold"] ?? new THREE.Color())} emissive={(colors["gold"] ?? new THREE.Color())} emissiveIntensity={0.8} /></mesh>)}
    <mesh ref={star} position={[0, 6.6, 0]}><octahedronGeometry args={[0.35]} /><meshStandardMaterial color={(colors["gold"] ?? new THREE.Color())} emissive={(colors["gold"] ?? new THREE.Color())} emissiveIntensity={2} /></mesh>
  </group>;
}

// All remaining gifts in 2 instanced meshes (wrapping + gold ribbons): 3 draw calls with the shadow pass, whatever the count.
function GiftPackages({ gifts, onCollect }: { gifts: (typeof GIFTS)[number][]; onCollect: (id: string) => void }) {
  const colors = useWeatherColors();
  const [hover, setHover] = useState<number | null>(null);
  const body = useRef<THREE.InstancedMesh>(null), ribbon = useRef<THREE.InstancedMesh>(null);
  const wrapping = useMerged(() => [{ geometry: new THREE.BoxGeometry(0.65, 0.6, 0.65), position: [0, 0.3, 0] }, { geometry: new THREE.BoxGeometry(0.7, 0.09, 0.7), position: [0, 0.61, 0] }], []);
  const ribbons = useMerged(() => [
    { geometry: new THREE.BoxGeometry(0.1, 0.72, 0.71), position: [0, 0.35, 0] }, { geometry: new THREE.BoxGeometry(0.71, 0.72, 0.1), position: [0, 0.35, 0] },
    ...[-1, 1].map(side => ({ geometry: new THREE.TorusGeometry(0.12, 0.028, 5, 12), position: [side * 0.12, 0.76, 0] as [number, number, number], rotation: [0, Math.PI / 2, side * 0.4] as [number, number, number] })),
  ], []);
  useEffect(() => {
    const matrix = new THREE.Matrix4(), color = new THREE.Color();
    for (const mesh of [body.current, ribbon.current]) {
      if (!mesh) continue;
      gifts.forEach((gift, i) => {
        mesh.setMatrixAt(i, matrix.makeTranslation(...gift.pos));
        if (mesh === body.current) mesh.setColorAt(i, color.copy(colors[GIFTS.indexOf(gift) % 2 ? "blue" : "red"] ?? color.set(0, 0, 0)).multiplyScalar(hover === i ? 2.2 : 1));
      });
      mesh.count = gifts.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [gifts, colors, hover]);
  const events = {
    onClick: (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); const gift = gifts[event.instanceId ?? -1]; if (gift) onCollect(gift.id); },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => setHover(event.instanceId ?? null), onPointerOut: () => setHover(null),
  };
  return <>
    <instancedMesh ref={body} args={[wrapping, undefined, GIFTS.length]} castShadow {...events}><meshStandardMaterial roughness={0.4} /></instancedMesh>
    <instancedMesh ref={ribbon} args={[ribbons, undefined, GIFTS.length]} {...events}><meshStandardMaterial color={(colors["gold"] ?? new THREE.Color())} metalness={0.5} roughness={0.2} /></instancedMesh>
  </>;
}

export function Fireworks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  const colors = useWeatherColors();
  const object = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: 160 }, (_, i) => ({ a: i * 2.39996, z: (i % 20) / 10 - 1, burst: Math.floor(i / 40) })), []);
  useEffect(() => { const m = mesh.current; if (m) particles.forEach((_, i) => m.setColorAt(i, colors[i % 2 ? "gold" : "aurora-rose"] ?? new THREE.Color())); }, [colors, particles]);
  useFrame((_, delta) => {
    time.current += Math.min(delta, 0.05);
    const m = mesh.current; if (!m) return;
    particles.forEach((p, i) => { const t = (time.current - p.burst * 0.8) % 4; const active = time.current < 16 && t >= 0 && t < 2.6; const r = Math.max(0, t) * 3; object.position.set(Math.cos(p.a) * r + (p.burst - 1.5) * 2, 9 + p.z * r - 0.8 * t * t, Math.sin(p.a) * r); object.scale.setScalar(active ? 0.055 * (1 - t / 2.6) : 0); object.updateMatrix(); m.setMatrixAt(i, object.matrix); });
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, 160]} frustumCulled={false}><sphereGeometry args={[1, 5, 5]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>;
}

export default function VillageActivities({ props, onCollect }: { props: ActivityProps; onCollect: (id: string) => void }) {
  const colors = useWeatherColors();
  const post = PLACES.find(place => place.id === "poste-pere-noel");
  const remaining = useMemo(() => GIFTS.filter(gift => !props.found.includes(gift.id)), [props.found]);
  return <>
    {post && <group position={[post.pos[0] + 1.2, 0, post.pos[2] - 1.2]} onClick={e => { e.stopPropagation(); props.onActivity("letter"); }}><mesh position-y={0.55}><cylinderGeometry args={[0.07, 0.07, 1.1, 8]} /><meshStandardMaterial color={(colors["gold"] ?? new THREE.Color())} /></mesh><mesh position-y={1.25}><boxGeometry args={[0.6, 0.45, 0.45]} /><meshStandardMaterial color={(colors["red"] ?? new THREE.Color())} /></mesh></group>}
    {props.hunting && <GiftPackages gifts={remaining} onCollect={onCollect} />}
    {props.hunting && huntComplete(props.found) && <Fireworks />}
  </>;
}