import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer } from "@react-three/drei";
import { XR, TeleportTarget, createXRStore, useXRSessionModeSupported } from "@react-three/xr";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useServerFn } from "@tanstack/react-start";
import { PLACES, type Place } from "@/lib/village-places";
import { planTour, type TourStop } from "@/lib/tour.functions";
import { MusicAudio, MusicControls, useChristmasMusic } from "./ChristmasMusic";
import SantaSleigh from "./SantaSleigh";
import ImmersiveVillage from "./ImmersiveVillage";
import { AR_DEFAULT_SCALE, scaleForAR, safeLanding, type GroundPosition } from "@/lib/xr-navigation";
import { ChimneySmoke, WeatherLighting } from "./VillageWeather";
import WeatherControls from "./WeatherControls";
import { snowfall, type Ambience } from "@/lib/village-weather";
import ActivityControls, { type Activity, type ActivityProps } from "./ActivityControls";
import WelcomeScreen from "./shell/WelcomeScreen";
import ActionBar, { type PanelId } from "./shell/ActionBar";
import TourChip from "./shell/TourChip";
import { ImmersionPanel, TourPanel } from "./shell/panels";
import VillageActivities, { TreeDecorations } from "./VillageActivities";
import { addGarland, addOrnament, collectGift, GIFTS, INITIAL_DECORATION, type Decoration } from "@/lib/village-activities";

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

declare global {
  interface Window { __villageActivities?: { viewGift: (index: number) => void; overview: () => void }; }
}
function ActivityProbe({ mode }: { mode: string }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV || mode !== "desktop") return;
    const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    window.__villageActivities = {
      viewGift: index => {
        const gift = GIFTS[index]; if (!gift || !c) return;
        const [x, , z] = gift.pos; camera.position.set(x + 3, 2.5, z + 3); c.target.set(x, 0.4, z); c.update();
      },
      overview: () => { camera.position.set(0, 14, 23); c?.target.set(0, 5, 0); c?.update(); },
    };
    return () => { delete window.__villageActivities; };
  }, [camera, controls, mode]);
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

function BigTree({ activities }: { activities: ActivityProps }) {
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
    <group onClick={event => { event.stopPropagation(); activities.onActivity("tree"); }}>
      <Tree position={[0, 0, 0]} scale={2.6} />
      <group ref={group}>
        {lights.map((l, i) => (
          <mesh key={i} position={l.p}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={l.c} emissive={l.c} />
          </mesh>
        ))}
      </group>
      <TreeDecorations decoration={activities.decoration} />
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

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function Scene({ focus, mode, teleport, ambience, snow, activities, onCollect, idle }: { focus: Place | null; mode: "desktop" | "vr" | "ar"; teleport?: ((point: GroundPosition) => void) | undefined; ambience: Ambience; snow: number; activities: ActivityProps; onCollect: (id: string) => void; idle: boolean }) {
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
      <BigTree activities={activities} />
      <VillageActivities props={activities} onCollect={onCollect} />
      <Tree position={[-11.3, 0, -3]} scale={1.4} />
      <Tree position={[2.5, 0, -11.3]} scale={1.4} />
      {houses.map((h, i) => <House key={i} position={h.p} rot={h.rot} color={h.c} />)}
      {trees.map((t, i) => <Tree key={i} position={t.p} scale={t.s} />)}
      <Snowman position={[4, 0, 3]} />
      <Snowman position={[-4.5, 0, -2.5]} />
      <Snow intensity={snow} />
      <Suspense fallback={null}><SantaSleigh stopId={focus?.id} /></Suspense>
      {focus && <Marker place={focus} />}
      {mode === "desktop" && <><CameraRig focus={focus} />
      <OrbitControls makeDefault target={[0, 2, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={30} autoRotate={idle} autoRotateSpeed={0.4} /></>}
      <ActivityProbe mode={mode} />
    </>
  );
}

export default function Village() {
  const [ready, setReady] = useState(false);
  const [ambience, setAmbience] = useState<Ambience>("night");
  const [snow, setSnow] = useState(30);
  const plan = useServerFn(planTour);
  const [welcome, setWelcome] = useState(true);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const music = useChristmasMusic();
  const reducedMotion = useReducedMotion();
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
  const [activity, setActivity] = useState<Activity>(null);
  const [found, setFound] = useState<string[]>([]);
  const [hunting, setHunting] = useState(false);
  const [decoration, setDecoration] = useState<Decoration>(INITIAL_DECORATION);
  const [activityFocus, setActivityFocus] = useState<Place | null>(null);
  const activities: ActivityProps = {
    activity, onActivity: value => {
      setActivity(value);
      setActivityFocus(value === "letter" ? PLACES.find(place => place.id === "poste-pere-noel") ?? null : value === "tree" ? PLACES[0] ?? null : null);
    }, found, hunting,
    onHunt: () => { setFound([]); setHunting(true); setActivityFocus(null); },
    decoration, onOrnament: color => setDecoration(current => addOrnament(current, color)),
    onGarland: () => setDecoration(addGarland), onStar: star => setDecoration(current => ({ ...current, star })),
    onResetTree: () => setDecoration(INITIAL_DECORATION),
  };
  function collect(id: string) { setFound(current => collectGift(current, id)); }
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
  const focus = activityFocus ?? (stop ? PLACES.find((p) => p.id === stop.id) ?? null : null);
  async function planWish() {
    if (!wish.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const r = await plan({ data: { wish } });
      if ("error" in r) setError(r.error);
      else { setTour(r); setStep(0); setActivityFocus(null); setActivity(null); setWelcome(false); }
    } catch { setError("Le guide n'a pas pu préparer votre parcours."); }
    finally { setLoading(false); }
  }
  function moveStep(direction: number) { setActivityFocus(null); setStep(current => Math.max(0, Math.min((tour?.stops.length ?? 1) - 1, current + direction))); }
  const xr = { vrSupported, arSupported, entering, onXR: enter, xrError };
  const wishForm = { wish, onWish: setWish, loading, error, onPlan: planWish };
  return (
    <div className="relative h-dvh w-full bg-background" data-scene-ready={ready || undefined}>
      <Canvas shadows camera={{ position: [0, 2.5, 7.5], fov: 60, near: 0.01 }} onCreated={() => setTimeout(() => setReady(true), 300)}>
        <XR store={store}>
          <ImmersiveVillage focus={focus} note={activityFocus ? undefined : stop?.note} step={step} count={tour?.stops.length ?? 0} activities={activities}
            onStep={moveStep}
            scale={arScale} onScale={value => setArScale(scaleForAR(value))}
            ambience={ambience} onAmbience={setAmbience} snow={snow} onSnow={setSnow}
            renderScene={(mode, teleport) => <Scene focus={focus} mode={mode} teleport={teleport} ambience={ambience} snow={snow} activities={activities} onCollect={collect} idle={welcome && !reducedMotion && !immersed} />} />
        </XR>
      </Canvas>
      {/* The audio element lives here so panels can open and close without stopping playback. */}
      <MusicAudio audioRef={music.audioRef} />
      {!immersed && (welcome
        ? <WelcomeScreen {...wishForm} {...xr} onEnter={() => setWelcome(false)} />
        : <>
          <ActionBar open={panel} onOpen={setPanel} hunting={hunting} found={found.length} panels={{
            tour: <TourPanel {...wishForm} tour={tour} step={step} focusName={focus?.name} note={stop?.note} onStep={moveStep} onReset={() => { setTour(null); setActivityFocus(null); }} />,
            activities: <ActivityControls {...activities} />,
            ambience: <WeatherControls ambience={ambience} onAmbience={setAmbience} snow={snow} onSnow={setSnow} />,
            music: <MusicControls {...music} />,
            immersion: <ImmersionPanel {...xr} />,
          }} />
          {tour && stop && focus && !activityFocus && <TourChip step={step} count={tour.stops.length} name={focus.name} onStep={moveStep} onOpen={() => setPanel("tour")} />}
        </>)}
    </div>
  );
}
