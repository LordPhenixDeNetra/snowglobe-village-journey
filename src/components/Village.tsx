import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, Sky } from "@react-three/drei";
import { XR, XROrigin, createXRStore } from "@react-three/xr";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useServerFn } from "@tanstack/react-start";
import { PLACES, type Place } from "@/lib/village-places";
import { planTour, type TourStop } from "@/lib/tour.functions";

function CameraRig({ focus }: { focus: Place | null }) {
  const done = useRef(true);
  const last = useRef<string | null>(null);
  useFrame(({ camera, controls }, d) => {
    const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!c || !focus) return;
    if (last.current !== focus.id) { last.current = focus.id; done.current = false; }
    if (done.current) return;
    const t = new THREE.Vector3(...focus.pos);
    const dir = t.clone().setY(0);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const camPos = t.clone().add(dir.multiplyScalar(focus.id === "grand-sapin" ? 9 : -5)).setY(focus.pos[1] + 2.5);
    const k = 1 - Math.exp(-3 * Math.min(d, 0.05));
    c.target.lerp(t, k);
    camera.position.lerp(camPos, k);
    c.update();
    if (camera.position.distanceTo(camPos) < 0.05) done.current = true;
  });
  return null;
}

function Marker({ place }: { place: Place }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = place.pos[1] + 2.4 + Math.sin(clock.elapsedTime * 2) * 0.2;
    ref.current.rotation.y = clock.elapsedTime;
  });
  return (
    <mesh ref={ref} position={[place.pos[0], place.pos[1] + 2.4, place.pos[2]]} rotation-x={Math.PI}>
      <coneGeometry args={[0.3, 0.7, 4]} />
      <meshStandardMaterial color="#ffd700" emissive="#ffb000" emissiveIntensity={2} />
    </mesh>
  );
}

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
      return { p: [Math.cos(a) * rad, 1 + h, Math.sin(a) * rad] as [number, number, number], c: ["#ff4040", "#ffd700", "#40a0ff", "#ffffff"][i % 4]! };
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
    const p = ref.current!.geometry.attributes["position"] as THREE.BufferAttribute;
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
      {([[0.5, 0.45], [0.35, 1.15], [0.25, 1.65]] as [number, number][]).map(([r, y], i) => (
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

function Scene({ focus }: { focus: Place | null }) {
  const houses = useMemo(() => {
    const colors = ["#b23a3a", "#2f6b4f", "#c98b3a", "#3b5a8a", "#8a4a6b", "#a85a32"];
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return { p: [Math.cos(a) * 9, 0, Math.sin(a) * 9] as [number, number, number], rot: -a - Math.PI / 2, c: colors[i % colors.length]! };
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
      {focus && <Marker place={focus} />}
      <CameraRig focus={focus} />
      <OrbitControls makeDefault target={[0, 2, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={30} />
    </>
  );
}

export default function Village() {
  const [ready, setReady] = useState(false);
  const plan = useServerFn(planTour);
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tour, setTour] = useState<{ title: string; stops: TourStop[] } | null>(null);
  const [step, setStep] = useState(0);
  const stop = tour?.stops[step];
  const focus = stop ? PLACES.find((p) => p.id === stop.id) ?? null : null;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!wish.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const r = await plan({ data: { wish } });
      if ("error" in r) setError(r.error);
      else { setTour(r); setStep(0); }
    } catch { setError("Le guide n'a pas pu préparer votre parcours."); }
    finally { setLoading(false); }
  }
  return (
    <div className="relative h-screen w-full bg-background" data-scene-ready={ready || undefined}>
      <Canvas shadows camera={{ position: [0, 2.5, 7.5], fov: 60 }} onCreated={() => setTimeout(() => setReady(true), 300)}>
        <XR store={store}>
          <XROrigin position={[0, 0, 6]} />
          <Scene focus={focus} />
        </XR>
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-6 text-center">
        <h1 className="text-4xl font-bold tracking-wide text-primary-foreground drop-shadow-lg">Village de Noël</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">Glissez pour tourner · Molette pour zoomer</p>
      </div>
      <div className="absolute right-4 top-24 w-80 max-w-[calc(100%-2rem)] rounded-2xl bg-card/90 p-4 text-card-foreground shadow-xl backdrop-blur">
        {!open && !tour ? (
          <button onClick={() => setOpen(true)} className="w-full rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground">✨ Mon parcours personnalisé</button>
        ) : !tour ? (
          <form onSubmit={submit} className="space-y-3">
            <p className="font-semibold">Que souhaitez-vous découvrir ?</p>
            <textarea value={wish} onChange={(e) => setWish(e.target.value)} maxLength={500} rows={3} placeholder="Ex. : des douceurs sucrées et des activités pour les enfants" className="w-full rounded-lg border border-input bg-background p-2 text-sm text-foreground" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button disabled={loading || !wish.trim()} className="w-full rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{loading ? "Le guide prépare votre parcours…" : "Créer mon parcours"}</button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tour.title}</p>
            <p className="text-lg font-bold">{step + 1}. {focus?.name}</p>
            <p className="text-sm">{stop?.note}</p>
            <div className="flex gap-2">
              <button disabled={step === 0} onClick={() => setStep(step - 1)} className="flex-1 rounded-full bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-40">Précédent</button>
              <button disabled={step >= tour.stops.length - 1} onClick={() => setStep(step + 1)} className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">Suivant</button>
            </div>
            <p className="text-xs text-muted-foreground">Étape {step + 1} / {tour.stops.length}</p>
            <button onClick={() => { setTour(null); setOpen(true); }} className="text-sm underline">Nouveau parcours</button>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-8 flex justify-center gap-3">
        <button onClick={() => store.enterVR()} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg transition hover:scale-105">Entrer en VR</button>
        <button onClick={() => store.enterAR()} className="rounded-full bg-secondary px-6 py-3 font-semibold text-secondary-foreground shadow-lg transition hover:scale-105">Entrer en AR</button>
      </div>
    </div>
  );
}
