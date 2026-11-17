import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { XROrigin, XRDomOverlay, useXR, useXRStore, useXRHitTest, useXRControllerButtonEvent } from "@react-three/xr";
import * as THREE from "three";
import { PLACES, type Place } from "@/lib/village-places";
import { AR_ROTATION_STEP, controllerTurn, horizontalHit, scaleForAR, VR_WORLD_SCALE, walkingTarget, walkingVelocity, walkOnGround, safeLanding, viewpoint, type GroundPosition, type WalkVelocity } from "@/lib/xr-navigation";
import { useImmersiveAudio } from "@/hooks/use-ar-audio";
import type { WeatherProps } from "./WeatherControls";
import { AMBIENCE_LABELS } from "@/lib/village-weather";
import { starNames, type ActivityProps } from "./ActivityControls";
import { nextStar, ORNAMENT_COLORS } from "@/lib/village-activities";
import { useServerFn } from "@tanstack/react-start";
import { writeSantaLetter } from "@/lib/santa-letter.functions";
import WorldPanel, { pulse } from "./xr/WorldPanel";
import VRPanel, { pressShared } from "./xr/VRPanel";
import AROverlay from "./xr/AROverlay";
import { arPanelRows } from "@/lib/xr-panel";
import { useWeatherColors } from "./VillageWeather";

export type ImmersiveProps = WeatherProps & {
  activities: ActivityProps;
  focus: Place | null;
  note?: string | undefined;
  step: number;
  count: number;
  onStep: (direction: number) => void;
  scale: number;
  onScale: (scale: number) => void;
};

// Canvas-backed labels avoid a remote font request inside the headset.
function WorldButton({ label, position, onClick, disabled = false }: {
  label: string; position: GroundPosition; onClick: () => void; disabled?: boolean;
}) {
  const [texture, setTexture] = useState<THREE.CanvasTexture>();
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768; canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return;
    const css = getComputedStyle(document.documentElement);
    context.fillStyle = css.getPropertyValue("--secondary").trim();
    context.fillRect(0, 0, 768, 256);
    context.fillStyle = css.getPropertyValue("--secondary-foreground").trim();
    context.font = "bold 48px sans-serif";
    context.textAlign = "center";
    const lines = label.split("\n");
    lines.forEach((line, i) => context.fillText(line, 384, 128 + (i - (lines.length - 1) / 2) * 60, 720));
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    setTexture(next);
    return () => next.dispose();
  }, [label]);
  return <mesh position={position} onClick={e => { e.stopPropagation(); if (!disabled) onClick(); }}>
    <planeGeometry args={[0.64, 0.21]} />
    <meshBasicMaterial map={texture ?? null} transparent opacity={disabled ? 0.4 : 1} toneMapped={false} />
  </mesh>;
}

function VRNavigation({ focus, note, step, count, onStep, ambience, onAmbience, snow, onSnow, activities, children }: ImmersiveProps & {
  children: (teleport: (point: GroundPosition) => void) => ReactNode;
}) {
  const origin = useRef<THREE.Group>(null);
  const camera = useThree(s => s.camera);
  const session = useXR(s => s.session);
  const soundModel = useRef<THREE.Group>(null);
  const audio = useImmersiveAudio(soundModel, !!session, focus, note, step, count, "vr");
  const [smooth, setSmooth] = useState(false);
  const [spot, setSpot] = useState(0);
  const heading = useRef<THREE.Group>(null);
  const xrStore = useXRStore();
  const velocity = useRef<WalkVelocity>({ x: 0, z: 0 });
  const lastFacing = useRef<WalkVelocity>({ x: 0, z: -1 });
  const headPosition = useMemo(() => new THREE.Vector3(), []);
  const headDirection = useMemo(() => new THREE.Vector3(), []);
  const turnArmed = useRef(true);
  const right = useXR(state => state.inputSourceStates.find(input => input.type === "controller" && input.inputSource.handedness === "right"));
  const rightController = right?.type === "controller" ? right : undefined;
  useXRControllerButtonEvent(rightController, "a-button", state => { if (state === "pressed" && count && step < count - 1) { onStep(1); pulse(session); } });
  useXRControllerButtonEvent(rightController, "b-button", state => { if (state === "pressed" && count && step > 0) { onStep(-1); pulse(session); } });
  function turn(angle: number) {
    const group = origin.current;
    if (!group) return;
    camera.getWorldPosition(headPosition);
    const x = headPosition.x, z = headPosition.z;
    group.rotation.y += angle;
    group.updateMatrixWorld(true);
    camera.getWorldPosition(headPosition);
    group.position.x += x - headPosition.x;
    group.position.z += z - headPosition.z;
  }

  function land(point: GroundPosition) {
    if (!origin.current || !safeLanding(point[0], point[2])) return;
    velocity.current = { x: 0, z: 0 };
    pulse(session);
    const head = camera.getWorldPosition(new THREE.Vector3());
    const feet = origin.current.getWorldPosition(new THREE.Vector3());
    origin.current.position.x += point[0] - head.x;
    origin.current.position.z += point[2] - head.z;
    origin.current.position.y -= feet.y;
  }
  function visit(place: Place) {
    land(viewpoint(place));
    const group = origin.current;
    if (!group) return;
    // Align the view toward the stop without tilting the visitor's head.
    const direction = camera.getWorldDirection(new THREE.Vector3());
    const head = camera.getWorldPosition(new THREE.Vector3());
    const yaw = Math.atan2(-direction.x, -direction.z);
    const target = Math.atan2(-(place.pos[0] - head.x), -(place.pos[2] - head.z));
    const before = head.clone();
    group.rotation.y += target - yaw;
    group.updateMatrixWorld(true);
    const after = camera.getWorldPosition(new THREE.Vector3());
    group.position.x += before.x - after.x;
    group.position.z += before.z - after.z;
  }
  useEffect(() => { if (focus) visit(focus); }, [focus?.id]);
  useFrame((_, delta) => {
    if (!heading.current || !origin.current) return;
    const rotationController = xrStore.getState().inputSourceStates.find(input => input.type === "controller" && input.inputSource.handedness === "right");
    const rotationStick = rotationController?.type === "controller" ? rotationController.gamepad["xr-standard-thumbstick"] : undefined;
    const rotation = controllerTurn(rotationStick?.xAxis ?? 0, smooth, turnArmed.current, delta);
    turnArmed.current = rotation.armed;
    if (rotation.angle) turn(rotation.angle);
    const controller = xrStore.getState().inputSourceStates.find(input => input.type === "controller" && input.inputSource.handedness === "left");
    const stick = controller?.type === "controller" ? controller.gamepad["xr-standard-thumbstick"] : undefined;
    camera.getWorldDirection(headDirection);
    if (Math.hypot(headDirection.x, headDirection.z) > 0.001) lastFacing.current = { x: headDirection.x, z: headDirection.z };
    velocity.current = walkingVelocity(velocity.current, walkingTarget(stick?.xAxis ?? 0, stick?.yAxis ?? 0, lastFacing.current), delta);
    camera.getWorldPosition(headPosition);
    const [x, , z] = walkOnGround([headPosition.x, 0, headPosition.z], velocity.current, delta);
    origin.current.position.x += x - headPosition.x;
    origin.current.position.z += z - headPosition.z;
    // local-floor supplies the real eye height, including crouching; never overwrite the headset pose.
    origin.current.position.y = 0;
    origin.current.updateMatrixWorld(true);
    const head = camera.getWorldPosition(new THREE.Vector3());
    origin.current.worldToLocal(head);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    direction.y = 0;
    direction.normalize().applyQuaternion(origin.current.quaternion.clone().invert());
    heading.current.position.set(head.x + direction.x * 1.4, head.y - 0.35, head.z + direction.z * 1.4);
    heading.current.rotation.y = Math.atan2(-direction.x, -direction.z);
  });
  return <>
    <XROrigin ref={origin} position={[0, 0, 6]} scale={VR_WORLD_SCALE}>
      <group ref={heading}>
        <VRPanel focus={focus} note={note} step={step} count={count} onStep={onStep} onVisit={visit} smooth={smooth} onSmooth={setSmooth}
          onViewpoint={() => { const next = (spot + 1) % PLACES.length; setSpot(next); const place = PLACES[next]; if (place) visit(place); }}
          audio={audio} ambience={ambience} onAmbience={onAmbience} snow={snow} onSnow={onSnow} activities={activities} session={session} />
        {activities.activity && <WorldActivities activities={activities} position={[1.3, 0.25, 0]} />}
      </group>
    </XROrigin>
    <group ref={soundModel}>{children(land)}</group>
  </>;
}

function ARPlacement({ children, scale, onScale, focus, note, step, count, onStep, ambience, onAmbience, snow, onSnow, activities }: ImmersiveProps & { children: ReactNode }) {
  const session = useXR(s => s.session);
  const xrStore = useXRStore();
  const camera = useThree(s => s.camera);
  const fallback = useRef<THREE.Group>(null);
  const anchor = useRef<XRAnchor | null>(null);
  const generation = useRef(0);
  const pendingPlace = useRef(false);
  const [rotation, setRotation] = useState(0);
  const [more, setMore] = useState(false);
  const [tracking, setTracking] = useState(false);
  const model = useRef<THREE.Group>(null);
  const soundModel = useRef<THREE.Group>(null);
  const reticle = useRef<THREE.Group>(null);
  const dot = useRef<THREE.Mesh>(null);
  const colors = useWeatherColors();
  const calm = useMemo(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const candidate = useRef(new THREE.Matrix4());
  const valid = useRef(false);
  const [found, setFound] = useState(false);
  const [placed, setPlaced] = useState(false);
  const placedRef = useRef(false);
  const audio = useImmersiveAudio(soundModel, placed && !tracking, focus, note, step, count);
  const world = useMemo(() => new THREE.Matrix4(), []);
  const ring = useMemo(() => new THREE.RingGeometry(0.075, 0.1, 48).rotateX(-Math.PI / 2), []);
  const centre = useMemo(() => new THREE.CircleGeometry(0.018, 24).rotateX(-Math.PI / 2), []);
  useEffect(() => () => { ring.dispose(); centre.dispose(); }, [ring, centre]);
  useEffect(() => () => { generation.current++; anchor.current?.delete(); anchor.current = null; }, []);
  useXRHitTest((results, getWorldMatrix) => {
    if (placedRef.current) return;
    const result = results[0];
    valid.current = !!result && getWorldMatrix(world, result);
    // Only horizontal surfaces are suitable for the miniature village.
    if (valid.current && !horizontalHit(world.elements)) valid.current = false;
    if (valid.current) candidate.current.copy(world);
    setFound(previous => previous === valid.current ? previous : valid.current);
    if (reticle.current) {
      reticle.current.visible = valid.current;
      reticle.current.matrix.copy(candidate.current);
    }
    if (pendingPlace.current && valid.current && result && model.current) {
      pendingPlace.current = false;
      model.current.position.setFromMatrixPosition(candidate.current);
      model.current.visible = true;
      placedRef.current = true;
      setPlaced(true);
      if (reticle.current) reticle.current.visible = false;
      const request = generation.current;
      // Anchors are optional; a fixed session-world pose remains usable if unavailable.
      if (result.createAnchor) void result.createAnchor().then(next => {
        if (request !== generation.current) { next.delete(); return; }
        anchor.current = next;
      }).catch(() => {});
    }
  }, "viewer", "plane");
  function place() {
    if (!valid.current || placedRef.current || !model.current) return;
    pendingPlace.current = true;
  }
  function reposition() {
    generation.current++;
    anchor.current?.delete(); anchor.current = null;
    pendingPlace.current = false; placedRef.current = false; valid.current = false;
    setPlaced(false); setFound(false); setTracking(false);
    if (model.current) model.current.visible = false;
  }
  useFrame((state, __, frame) => {
    if (dot.current && !calm) dot.current.scale.setScalar(1 + 0.3 * Math.sin(state.clock.elapsedTime * 4));
    const reference = xrStore.getState().originReferenceSpace;
    if (anchor.current && frame && reference && model.current) {
      const pose = frame.getPose(anchor.current.anchorSpace, reference);
      if (pose) model.current.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
      model.current.visible = !!pose;
      setTracking(previous => previous === !pose ? previous : !pose);
    }
    if (fallback.current) {
      camera.getWorldPosition(fallback.current.position);
      fallback.current.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
    }
  });
  useEffect(() => {
    if (!session) return;
    session.addEventListener("select", place);
    return () => session.removeEventListener("select", place);
  }, [session]);
  return <>
    <XROrigin />
    <group ref={reticle} matrixAutoUpdate={false} visible={false}>
      <mesh geometry={ring} onClick={place}><meshBasicMaterial color={colors["gold"] ?? "white"} transparent opacity={0.65} side={THREE.DoubleSide} /></mesh>
      <mesh ref={dot} geometry={centre}><meshBasicMaterial color={colors["gold"] ?? "white"} side={THREE.DoubleSide} /></mesh>
    </group>
    <group ref={model} visible={false}><group ref={soundModel} scale={scaleForAR(scale)} rotation-y={rotation}>{children}</group></group>
    {!session?.domOverlayState && <group ref={fallback}>
      {/* Below the line of sight (top edge 0.2 m under eye level at 1.2 m), so the miniature stays in view. */}
      <WorldPanel position={[0, -0.2, -1.2]} scale={0.6} rows={arPanelRows({
        placed, surface: found, focusName: focus?.name ?? null, step, count, more,
        audio: { enabled: audio.enabled, busy: audio.busy, speaking: audio.speaking, error: audio.error },
        ambienceLabel: AMBIENCE_LABELS[ambience], snow, found: activities.found.length, activity: activities.activity,
      })} onPress={id => {
        if (id === "place") place();
        else if (id === "more") setMore(value => !value);
        else if (id === "exit") void session?.end();
        else if (id === "reposition") reposition();
        else if (id === "prev") onStep(-1);
        else if (id === "next") onStep(1);
        else if (id === "smaller") onScale(scaleForAR(scale - 0.005));
        else if (id === "bigger") onScale(scaleForAR(scale + 0.005));
        else if (id === "rotate") setRotation(value => value + AR_ROTATION_STEP);
        else pressShared(id, { activities, ambience, onAmbience, snow, onSnow, audio });
      }} />
      {placed && activities.activity && <WorldActivities activities={activities} position={[1.3, 0.35, -1.2]} />}
    </group>}
    <XRDomOverlay className="pointer-events-none fixed inset-0">
      <AROverlay state={{
        placed, found, tracking, focusName: focus?.name ?? null, note, step, count,
        audio: { enabled: audio.enabled, busy: audio.busy, speaking: audio.speaking, error: audio.error },
        scale, rotationDeg: (rotation * 180 / Math.PI) % 360, ambience, snow, activities,
      }} actions={{
        place, reposition, exit: () => { void session?.end(); }, onStep,
        startAudio: () => { void audio.start(); }, stopAudio: audio.stop, repeat: audio.repeat,
        onScale, onRotation: degrees => setRotation(degrees * Math.PI / 180), onAmbience, onSnow,
      }} />
    </XRDomOverlay>
  </>;
}

function WorldActivities({ activities, position }: { activities: ActivityProps; position: GroundPosition }) {
  const [color, setColor] = useState(0);
  const currentColor = ORNAMENT_COLORS[color] ?? "red";
  return <group position={position}>
    {/* The activity choice itself lives in the panel row (Poste, Cadeaux, Sapin); only its tools show here. */}
    {activities.activity === "hunt" && <WorldButton label="Recommencer la chasse" position={[0, 0, 0]} onClick={activities.onHunt} />}
    {activities.activity === "tree" && <>
      <WorldButton label={`Couleur · ${{ red: "Rouge", blue: "Bleu", gold: "Or", green: "Vert" }[currentColor]}`} position={[0, 0, 0]} onClick={() => setColor(value => (value + 1) % 4)} />
      <WorldButton label={`+ Boule · ${activities.decoration.ornaments.length}/60`} position={[0, -0.25, 0]} onClick={() => activities.onOrnament(currentColor)} disabled={activities.decoration.ornaments.length >= 60} />
      <WorldButton label={`+ Guirlande · ${activities.decoration.garlands}/3`} position={[0, -0.5, 0]} onClick={activities.onGarland} disabled={activities.decoration.garlands >= 3} />
      <WorldButton label={`Étoile · ${starNames[activities.decoration.star]}`} position={[0, -0.75, 0]} onClick={() => activities.onStar(nextStar(activities.decoration.star))} />
      <WorldButton label="Réinitialiser le sapin" position={[0, -1, 0]} onClick={activities.onResetTree} />
    </>}
    {activities.activity === "letter" && <WorldLetter />}
  </group>;
}

function WorldLetter() {
  const send = useServerFn(writeSantaLetter);
  const [letter, setLetter] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [texture, setTexture] = useState<THREE.CanvasTexture>();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue("--parchment").trim(); ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = css.getPropertyValue("--parchment-ink").trim(); ctx.font = "40px serif";
    const words = (reply || letter || "Cher Père Noël…").split(/\s+/); const lines: string[] = []; let line = "";
    for (const word of words) { if (ctx.measureText(`${line} ${word}`).width > 900) { lines.push(line); line = word; } else line += `${line ? " " : ""}${word}`; } if (line) lines.push(line);
    lines.slice(page * 16, (page + 1) * 16).forEach((text, i) => ctx.fillText(text, 60, 90 + i * 55));
    ctx.font = "28px sans-serif"; ctx.fillText("Réponse imaginaire générée par IA · Ne partagez pas d’adresse.", 60, 990, 900);
    const next = new THREE.CanvasTexture(canvas); next.colorSpace = THREE.SRGBColorSpace; setTexture(next); return () => next.dispose();
  }, [letter, reply, page]);
  async function submit() {
    if (!letter.trim() || busy) return; setBusy(true); setKeyboard(false);
    try { const result = await send({ data: { name: "", letter } }); setReply("reply" in result ? result.reply : result.error); setPage(0); }
    catch { setReply("La Poste est momentanément indisponible. Votre lettre est conservée."); }
    finally { setBusy(false); }
  }
  return <group position={[0.2, 0.1, 0]}>
    <mesh position={[0, -0.35, 0]}><planeGeometry args={[0.95, 0.95]} /><meshBasicMaterial map={texture ?? null} toneMapped={false} /></mesh>
    <WorldButton label={busy ? "Réponse en préparation…" : "Envoyer ma lettre"} position={[0, -0.95, 0]} disabled={busy || !letter.trim()} onClick={() => { void submit(); }} />
    <WorldButton label="Écrire / modifier" position={[0, -1.2, 0]} onClick={() => { setReply(""); setPage(0); setKeyboard(!keyboard); }} />
    <WorldButton label="Page suivante" position={[0, -1.45, 0]} onClick={() => setPage(value => (value + 1) % 3)} />
    {keyboard && <group position={[0, -1.75, 0.05]}>
      {"ABCDEFGHIJKLMNOPQRSTUVWXYZ .,!?éèà’".split("").map((key, i) => <group key={i} position={[(i % 7 - 3) * 0.15, -Math.floor(i / 7) * 0.13, 0]} scale={0.2}><WorldButton label={key === " " ? "␣" : key} position={[0, 0, 0]} onClick={() => { setLetter(value => (value + key).slice(0, 1500)); setPage(0); }} /></group>)}
      <WorldButton label="Effacer" position={[0, -0.7, 0]} onClick={() => setLetter(value => value.slice(0, -1))} />
    </group>}
  </group>;
}

export default function ImmersiveVillage(props: ImmersiveProps & {
  renderScene: (mode: "desktop" | "vr" | "ar", teleport?: (point: GroundPosition) => void) => ReactNode;
}) {
  const mode = useXR(s => s.mode);
  if (mode === "immersive-vr") return <VRNavigation {...props}>{teleport => props.renderScene("vr", teleport)}</VRNavigation>;
  if (mode === "immersive-ar") return <ARPlacement {...props}>{props.renderScene("ar")}</ARPlacement>;
  return <>{props.renderScene("desktop")}</>;
}