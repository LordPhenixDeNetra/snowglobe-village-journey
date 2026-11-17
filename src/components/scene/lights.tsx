import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Ambience } from "@/lib/village-weather";
import { garlandPoint, garlandSpans, LAMP_POSTS, lampPoolOpacity } from "@/lib/village-props";
import { useWeatherColors } from "../VillageWeather";
import { box, TWINKLE_STEP, useRadialTexture, useTintedMerge } from "./geometry";

const black = () => new THREE.Color();
const HEAD_Y = 2.6;
const BULBS_PER_SPAN = 14;

/** Write one matrix per lamp post into an instanced mesh. */
function placeAll(mesh: THREE.InstancedMesh | null, y = 0) {
  if (!mesh) return;
  const object = new THREE.Object3D();
  LAMP_POSTS.forEach(([x, z], i) => {
    object.position.set(x, y, z);
    object.updateMatrix();
    mesh.setMatrixAt(i, object.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

export function LampPosts({ ambience, desktop }: { ambience: Ambience; desktop: boolean }) {
  const colors = useWeatherColors();
  const posts = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);
  const pool = useRadialTexture();
  // Stone post and hat, then a snow cap on the hat: one geometry coloured per vertex (no extra draw call).
  const post = useTintedMerge(
    () => [
      [
        { geometry: box(0.36, 0.12, 0.36, 0.03), position: [0, 0.06, 0] },
        { geometry: new THREE.CylinderGeometry(0.06, 0.08, 2.5, 8), position: [0, 1.3, 0] },
        {
          geometry: new THREE.ConeGeometry(0.26, 0.2, 4),
          position: [0, HEAD_Y + 0.27, 0],
          rotation: [0, Math.PI / 4, 0],
        },
        {
          geometry: new THREE.ConeGeometry(0.2, 0.12, 4),
          position: [0, HEAD_Y + 0.4, 0],
          rotation: [0, Math.PI / 4, 0],
        },
      ],
      [
        {
          geometry: new THREE.ConeGeometry(0.27, 0.1, 4),
          position: [0, HEAD_Y + 0.25, 0],
          rotation: [0, Math.PI / 4, 0],
        },
        {
          geometry: new THREE.ConeGeometry(0.21, 0.1, 4),
          position: [0, HEAD_Y + 0.43, 0],
          rotation: [0, Math.PI / 4, 0],
        },
      ],
    ],
    [],
    [colors["stone"], colors["snow"]],
  );
  const flat = useMemo(() => new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2), []);
  useEffect(() => () => flat.dispose(), [flat]);
  useEffect(() => {
    placeAll(posts.current);
    placeAll(heads.current, HEAD_Y);
    placeAll(pools.current, 0.02);
  }, []);
  // Real lights only on desktop, on the three posts nearest the default camera.
  const lit = useMemo(
    () =>
      [...LAMP_POSTS]
        .sort((a, b) => Math.hypot(a[0], a[1] - 7.5) - Math.hypot(b[0], b[1] - 7.5))
        .slice(0, 3),
    [],
  );
  const opacity = lampPoolOpacity(ambience);
  const lantern = colors["lantern"] ?? black();
  // Additive over bright snow saturates fast: the painted pool uses a dimmed copy of the lantern colour.
  const glow = useMemo(() => lantern.clone().multiplyScalar(0.45), [lantern]);
  return (
    <>
      <instancedMesh ref={posts} args={[post, undefined, LAMP_POSTS.length]}>
        <meshStandardMaterial vertexColors roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, LAMP_POSTS.length]}>
        <boxGeometry args={[0.28, 0.34, 0.28]} />
        <meshBasicMaterial color={lantern} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={pools} args={[flat, undefined, LAMP_POSTS.length]} visible={opacity > 0}>
        <meshBasicMaterial
          map={pool}
          color={glow}
          transparent
          opacity={opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
      {/* Always mounted (0 by day): adding or removing lights would recompile every lit shader on an ambience change. */}
      {desktop &&
        lit.map(([x, z]) => (
          <pointLight
            key={`${x},${z}`}
            position={[x, HEAD_Y, z]}
            intensity={6 * opacity}
            distance={7}
            decay={2}
            color={lantern}
          />
        ))}
    </>
  );
}

export function Garlands() {
  const colors = useWeatherColors();
  const bulbs = useRef<THREE.InstancedMesh>(null);
  const spans = useMemo(() => garlandSpans(), []);
  const cables = useMemo(() => {
    const positions: number[] = [];
    for (const { from, to } of spans)
      for (let i = 0; i < 24; i++)
        positions.push(...garlandPoint(from, to, i / 24), ...garlandPoint(from, to, (i + 1) / 24));
    return new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
  }, [spans]);
  useEffect(() => () => cables.dispose(), [cables]);
  const palette = useMemo(
    () => (["red", "gold", "blue", "green"] as const).map((name) => colors[name] ?? black()),
    [colors],
  );
  useEffect(() => {
    const mesh = bulbs.current;
    if (!mesh) return;
    const object = new THREE.Object3D();
    spans.forEach(({ from, to }, s) => {
      for (let b = 0; b < BULBS_PER_SPAN; b++) {
        const i = s * BULBS_PER_SPAN + b;
        object.position.set(...garlandPoint(from, to, (b + 0.5) / BULBS_PER_SPAN));
        object.position.y -= 0.06;
        object.updateMatrix();
        mesh.setMatrixAt(i, object.matrix);
        mesh.setColorAt(i, palette[i % 4] ?? black());
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [spans, palette]);
  const tint = useMemo(() => new THREE.Color(), []);
  const since = useRef(0);
  useFrame(({ clock }, dt) => {
    const mesh = bulbs.current;
    since.current += dt;
    if (!mesh || since.current < TWINKLE_STEP) return;
    since.current = 0;
    const t = clock.elapsedTime;
    for (let i = 0; i < spans.length * BULBS_PER_SPAN; i++)
      mesh.setColorAt(
        i,
        tint.copy(palette[i % 4] ?? black()).multiplyScalar(0.6 + 0.4 * Math.sin(t * 4 + i)),
      );
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <lineSegments geometry={cables}>
        <lineBasicMaterial color={colors["bark"] ?? black()} />
      </lineSegments>
      <instancedMesh ref={bulbs} args={[undefined, undefined, spans.length * BULBS_PER_SPAN]}>
        <sphereGeometry args={[0.06, 6, 5]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}
