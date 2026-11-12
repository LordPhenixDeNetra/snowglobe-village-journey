import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { XR, TeleportTarget, createXRStore, useXRSessionModeSupported } from "@react-three/xr";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useServerFn } from "@tanstack/react-start";
import { PLACES, type Place } from "@/lib/village-places";
import { planTour, type TourStop } from "@/lib/tour.functions";
import ChristmasMusic from "./ChristmasMusic";
import SantaSleigh from "./SantaSleigh";
import ImmersiveVillage from "./ImmersiveVillage";
import { Button } from "@/components/ui/button";
import { AR_DEFAULT_SCALE, scaleForAR, safeLanding, type GroundPosition } from "@/lib/xr-navigation";
import { ChimneySmoke, WeatherLighting } from "./VillageWeather";
import WeatherControls from "./WeatherControls";
import { snowfall, type Ambience } from "@/lib/village-weather";

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

const store = createXRStore({
  emulate: false, offerSession: false, enterGrantedSession: false,
  controller: { model: true, rayPointer: true, grabPointer: true, teleportPointer: true },
  hand: { rayPointer: true, touchPointer: true, teleportPointer: true },
  screenInput: true, transientPointer: true,
  hitTest: true, anchors: true, domOverlay: true,
});

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
      <ChimneySmoke />
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
      return { p: [Math.cos(a) * rad, 1 + h, Math.sin(a) * rad] as [number, number, number], c: ["#ff4040", "#ffd700", "#40a0ff", "#ffffff"][i % 4] ?? "#ffffff" };
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

function Snow({ intensity }: { intensity: number }) {
  const { count, speed, wind } = snowfall(intensity);
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
    if (!ref.current) return;
    const p = ref.current.geometry.attributes["position"] as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = p.getY(i) - dt * speed;
      if (y < 0) y = 15;
      p.setY(i, y);
      let x = p.getX(i) + (Math.sin(y + i) * 0.1 + wind) * dt;
      if (x > 20) x = -20;
      p.setX(i, x);
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

function Scene({ focus, mode, teleport, ambience, snow }: { focus: Place | null; mode: "desktop" | "vr" | "ar"; teleport?: ((point: GroundPosition) => void) | undefined; ambience: Ambience; snow: number }) {
  const houses = useMemo(() => {
    const colors = ["#b23a3a", "#2f6b4f", "#c98b3a", "#3b5a8a", "#8a4a6b", "#a85a32"];
    return Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return { p: [Math.cos(a) * 9, 0, Math.sin(a) * 9] as [number, number, number], rot: -a - Math.PI / 2, c: colors[i % colors.length] ?? colors[0] ?? "#b23a3a" };
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
      <WeatherLighting ambience={ambience} ar={mode === "ar"} />
      <Environment>
        <Lightformer intensity={1} position={[0, 5, 0]} scale={[10, 10, 1]} color="#aac" />
      </Environment>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[mode === "ar" ? 23 : 40, 64]} />
        <meshStandardMaterial color="#e8eef7" roughness={1} />
      </mesh>
      {mode === "vr" && <TeleportTarget onTeleport={(_, event) => {
        const point = event.point;
        if (safeLanding(point.x, point.z)) teleport?.([point.x, 0, point.z]);
      }}><mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[2.8, 12, 64]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh></TeleportTarget>}
      <BigTree />
      {houses.map((h, i) => <House key={i} position={h.p} rot={h.rot} color={h.c} />)}
      {trees.map((t, i) => <Tree key={i} position={t.p} scale={t.s} />)}
      <Snowman position={[4, 0, 3]} />
      <Snowman position={[-4.5, 0, -2.5]} />
      <Snow intensity={snow} />
      <Suspense fallback={null}><SantaSleigh stopId={focus?.id} /></Suspense>
      {focus && <Marker place={focus} />}
      {mode === "desktop" && <><CameraRig focus={focus} />
      <OrbitControls makeDefault target={[0, 2, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={30} /></>}
    </>
  );
}

export default function Village() {
  const [ready, setReady] = useState(false);
  const [ambience, setAmbience] = useState<Ambience>("dusk");
  const [snow, setSnow] = useState(30);
  const plan = useServerFn(planTour);
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tour, setTour] = useState<{ title: string; stops: TourStop[] } | null>(null);
  const [step, setStep] = useState(0);
  const vrSupported = useXRSessionModeSupported("immersive-vr");
  const arSupported = useXRSessionModeSupported("immersive-ar");
  const [xrError, setXrError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [arScale, setArScale] = useState(AR_DEFAULT_SCALE);
  const [immersed, setImmersed] = useState(false);
  useEffect(() => store.subscribe(state => setImmersed(!!state.session)), []);
  async function enter(mode: "VR" | "AR") {
    setXrError(null); setEntering(true);
    try {
      const session = mode === "VR" ? await store.enterVR() : await store.enterAR();
      if (!session) setXrError("Impossible d’ouvrir ce mode sur cet appareil.");
      else if (mode === "AR" && session.enabledFeatures && !session.enabledFeatures.includes("hit-test")) {
        await session.end();
        setXrError("Ce navigateur ne permet pas de placer le village sur une surface. Ouvrez-le dans un navigateur compatible WebXR AR.");
      }
    } catch { setXrError("L’immersion n’a pas démarré. Vérifiez les autorisations et votre appareil WebXR."); }
    finally { setEntering(false); }
  }
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
    <div className="relative h-dvh w-full bg-background" data-scene-ready={ready || undefined}>
      <Canvas shadows camera={{ position: [0, 2.5, 7.5], fov: 60, near: 0.01 }} onCreated={() => setTimeout(() => setReady(true), 300)}>
        <XR store={store}>
          <ImmersiveVillage focus={focus} note={stop?.note} step={step} count={tour?.stops.length ?? 0}
            onStep={direction => setStep(current => Math.max(0, Math.min((tour?.stops.length ?? 1) - 1, current + direction)))}
            scale={arScale} onScale={value => setArScale(scaleForAR(value))}
            ambience={ambience} onAmbience={setAmbience} snow={snow} onSnow={setSnow}
            renderScene={(mode, teleport) => <Scene focus={focus} mode={mode} teleport={teleport} ambience={ambience} snow={snow} />} />
        </XR>
      </Canvas>
      <div className={immersed ? "hidden" : "contents"}><ChristmasMusic /></div>
      {!immersed && <>
      <div className="pointer-events-none absolute inset-x-0 top-6 text-center">
        <h1 className="text-4xl font-bold tracking-wide text-primary-foreground drop-shadow-lg">Village de Noël</h1>
      </div>
      <div className="absolute right-4 top-24 max-h-[calc(100dvh-14rem)] w-80 max-w-[calc(100%-2rem)] overflow-y-auto rounded-lg bg-card/90 p-4 text-card-foreground shadow-xl backdrop-blur">
        <div className="mb-3 border-b border-border pb-3"><WeatherControls ambience={ambience} onAmbience={setAmbience} snow={snow} onSnow={setSnow} /></div>
        {!open && !tour ? (
          <Button onClick={() => setOpen(true)} className="w-full">✨ Mon parcours personnalisé</Button>
        ) : !tour ? (
          <form onSubmit={submit} className="space-y-3">
            <p className="font-semibold">Que souhaitez-vous découvrir ?</p>
            <textarea value={wish} onChange={(e) => setWish(e.target.value)} maxLength={500} rows={3} placeholder="Ex. : des douceurs sucrées et des activités pour les enfants" className="w-full rounded-lg border border-input bg-background p-2 text-sm text-foreground" />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || !wish.trim()} className="h-auto min-h-9 w-full whitespace-normal">{loading ? "Le guide prépare votre parcours…" : "Créer mon parcours"}</Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tour.title}</p>
            <p className="text-lg font-bold">{step + 1}. {focus?.name}</p>
            <p className="text-sm">{stop?.note}</p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)} className="flex-1">Précédent</Button>
              <Button disabled={step >= tour.stops.length - 1} onClick={() => setStep(step + 1)} className="flex-1">Suivant</Button>
            </div>
            <p className="text-xs text-muted-foreground">Étape {step + 1} / {tour.stops.length}</p>
            <Button variant="link" onClick={() => { setTour(null); setOpen(true); }}>Nouveau parcours</Button>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 px-4">
        {xrError && <p role="alert" className="max-w-md rounded-md bg-card p-2 text-center text-sm text-destructive">{xrError}</p>}
        <div className="flex gap-3">
          <Button disabled={entering || !vrSupported} onClick={() => enter("VR")} size="lg">{vrSupported === undefined ? "Vérification VR…" : vrSupported ? "Entrer en VR" : "VR indisponible"}</Button>
          <Button disabled={entering || !arSupported} onClick={() => enter("AR")} variant="secondary" size="lg">{arSupported === undefined ? "Vérification AR…" : arSupported ? "Entrer en AR" : "AR indisponible"}</Button>
        </div>
      </div>
      </>}
    </div>
  );
}
