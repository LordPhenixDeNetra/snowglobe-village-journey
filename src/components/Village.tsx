import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, Sky } from "@react-three/drei";
import { XR, XROrigin, createXRStore } from "@react-three/xr";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

const store = createXRStore();

function rand(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function House({ position, color, rot }: { position: [number, number, number]; color: string; rot: number }) {
  return (
    <group position={position} rotation-y={rot}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 1.5, 1.6]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.95, 0]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[1.65, 1, 4]} />
        <meshStandardMaterial color="#f4f7fb" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.45, 0.81]}>
        <boxGeometry args={[0.45, 0.9, 0.05]} />
        <meshStandardMaterial color="#5a3420" />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.95, 0.81]}>
          <boxGeometry args={[0.4, 0.4, 0.05]} />
          <meshStandardMaterial color="#ffd27a" emissive="#ffb84d" emissiveIntensity={1.5} />
        </mesh>
      ))}
      <mesh position={[0.55, 2.2, -0.3]} castShadow>
        <boxGeometry args={[0.3, 0.7, 0.3]} />
        <meshStandardMaterial color="#8a3b2e" />
      </mesh>
    </group>
  );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.6]} />
        <meshStandardMaterial color="#5b3a22" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.9 + i * 0.55, 0]} castShadow>
          <coneGeometry args={[0.9 - i * 0.25, 0.9, 8]} />
          <meshStandardMaterial color={i % 2 ? "#1f5e3a" : "#24704a"} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function BigTree() {
  const lights = useMemo(() => {
    const r = rand(7);
    return Array.from({ length: 60 }, (_, i) => {
      const h = r() * 4.2;
      const rad = (1 - h / 4.8) * 1.9;
      const a = r() * Math.PI * 2;
      return { p: [Math.cos(a) * rad, 1 + h, Math.sin(a) * rad] as [number, number, number], c: ["#ff4040", "#ffd700", "#40a0ff", "#ffffff"][i % 4] };
    });
  }, []);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((m, i) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(clock.elapsedTime * 3 + i) * 1.2;
    });
  });
  return (
    <group>
      <Tree position={[0, 0, 0]} scale={2.6} />
      <group ref={group}>
        {lights.map((l, i) => (
          <mesh key={i} position={l.p}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={l.c} emissive={l.c} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 6.6, 0]}>
        <octahedronGeometry args={[0.35]} />
        <meshStandardMaterial color="#ffd700" emissive="#ffc400" emissiveIntensity={2} />
      </mesh>
      <pointLight position={[0, 4, 0]} intensity={8} distance={10} color="#ffcf80" />
    </group>
  );
}

function Snow({ count = 1500 }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const r = rand(3);
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (r() - 0.5) * 40;
      a[i * 3 + 1] = r() * 15;
      a[i * 3 + 2] = (r() - 0.5) * 40;
    }
    return a;
  }, [count]);
  useFrame((_, d) => {
    const dt = Math.min(d, 0.05);
    const p = ref.current!.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) - dt * 0.8;
      if (y < 0) y = 15;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(y + i) * dt * 0.1);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.08} transparent opacity={0.9} />
    </points>
  );
}

function Snowman({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[[0.5, 0.45], [0.35, 1.15], [0.25, 1.65]].map(([r, y], i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <sphereGeometry args={[r, 16, 16]} />
          <meshStandardMaterial color="#fafcff" />
        </mesh>
      ))}
      <mesh position={[0, 1.65, 0.27]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[0.05, 0.3, 8]} />
        <meshStandardMaterial color="#ff7a1a" />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.3]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

function Scene() {
  const houses = useMemo(() => {
    const colors = ["#b23a3a", "#2f6b4f", "#c98b3a", "#3b5a8a", "#8a4a6b", "#a85a32"];
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return { p: [Math.cos(a) * 9, 0, Math.sin(a) * 9] as [number, number, number], rot: -a - Math.PI / 2, c: colors[i % colors.length] };
    });
  }, []);
  const trees = useMemo(() => {
    const r = rand(11);
    return Array.from({ length: 40 }, () => {
      const a = r() * Math.PI * 2, d = 13 + r() * 8;
      return { p: [Math.cos(a) * d, 0, Math.sin(a) * d] as [number, number, number], s: 0.8 + r() * 0.9 };
    });
  }, []);
  return (
    <>
      <color attach="background" args={["#1b2a44"]} />
      <fog attach="fog" args={["#1b2a44", 15, 40]} />
      <Sky distance={450} sunPosition={[0, -0.05, -1]} turbidity={8} rayleigh={0.5} />
      <ambientLight intensity={0.35} color="#9fb6e0" />
      <directionalLight position={[10, 15, 5]} intensity={0.8} color="#c8d8ff" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <Environment>
        <Lightformer intensity={1} position={[0, 5, 0]} scale={[10, 10, 1]} color="#aac" />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[40, 64]} />
        <meshStandardMaterial color="#e8eef7" roughness={1} />
      </mesh>
      <BigTree />
      {houses.map((h, i) => <House key={i} position={h.p} rot={h.rot} color={h.c} />)}
      {trees.map((t, i) => <Tree key={i} position={t.p} scale={t.s} />)}
      <Snowman position={[4, 0, 3]} />
      <Snowman position={[-4.5, 0, -2.5]} />
      <Snow />
      <OrbitControls target={[0, 2, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={30} />
    </>
  );
}

export default function Village() {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative h-screen w-full bg-background" data-scene-ready={ready || undefined}>
      <Canvas shadows camera={{ position: [0, 2.5, 7.5], fov: 60 }} onCreated={() => setTimeout(() => setReady(true), 300)}>
        <XR store={store}>
          <XROrigin position={[0, 0, 6]} />
          <Scene />
        </XR>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-6 text-center">
        <h1 className="text-4xl font-bold tracking-wide text-primary-foreground drop-shadow-lg">Village de Noël</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">Glissez pour tourner · Molette pour zoomer</p>
      </div>
      <div className="absolute inset-x-0 bottom-8 flex justify-center gap-3">
        <button onClick={() => store.enterVR()} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg transition hover:scale-105">Entrer en VR</button>
        <button onClick={() => store.enterAR()} className="rounded-full bg-secondary px-6 py-3 font-semibold text-secondary-foreground shadow-lg transition hover:scale-105">Entrer en AR</button>
      </div>
    </div>
  );
}
