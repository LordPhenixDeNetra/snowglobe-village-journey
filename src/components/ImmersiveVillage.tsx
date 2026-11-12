import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { XROrigin, XRDomOverlay, useXR, useXRStore, useXRHitTest, useXRControllerButtonEvent } from "@react-three/xr";
import * as THREE from "three";
import { PLACES, type Place } from "@/lib/village-places";
import { AR_ROTATION_STEP, controllerTurn, horizontalHit, scaleForAR, VR_WORLD_SCALE, walkingTarget, walkingVelocity, walkOnGround, safeLanding, viewpoint, type GroundPosition, type WalkVelocity } from "@/lib/xr-navigation";
import { Button } from "@/components/ui/button";
import { useImmersiveAudio } from "@/hooks/use-ar-audio";
import { Volume2, VolumeX, RotateCcw } from "lucide-react";
import WeatherControls, { type WeatherProps } from "./WeatherControls";
import { nextAmbience, AMBIENCE_LABELS } from "@/lib/village-weather";

export type ImmersiveProps = WeatherProps & {
  focus: Place | null;
  note?: string | undefined;
  step: number;
  count: number;
  onStep: (direction: number) => void;
  scale: number;
  onScale: (scale: number) => void;
};

function pulse(session: XRSession | undefined) {
  const input = Array.from(session?.inputSources ?? []).find(source => source.gamepad?.hapticActuators?.length);
  const actuator = input?.gamepad?.hapticActuators?.[0];
  if (actuator) void actuator.pulse(0.25, 35).catch(() => {});
}

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

function VRNavigation({ focus, note, step, count, onStep, ambience, onAmbience, snow, onSnow, children }: ImmersiveProps & {
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
        <WorldButton label={focus ? `${step + 1}/${count} · ${focus.name}\n${note ?? ""}` : "Village de Noël\nPromenade libre"} position={[0, 0.28, 0]} onClick={() => { if (focus) visit(focus); }} />
        <WorldButton label="Précédent" position={[-0.35, 0, 0]} disabled={!count || step === 0} onClick={() => onStep(-1)} />
        <WorldButton label="Suivant" position={[0.35, 0, 0]} disabled={!count || step === count - 1} onClick={() => onStep(1)} />
        <WorldButton label={smooth ? "Rotation fluide" : "Rotation par à-coups"} position={[-0.35, -0.25, 0]} onClick={() => setSmooth(!smooth)} />
        <WorldButton label="Point de vue suivant" position={[0.35, -0.25, 0]} onClick={() => { const next = (spot + 1) % PLACES.length; setSpot(next); const place = PLACES[next]; if (place) visit(place); }} />
        <WorldButton label="Quitter la VR" position={[0, -0.5, 0]} onClick={() => { void session?.end(); }} />
        <WorldButton label={audio.busy ? "Chargement des sons…" : audio.enabled ? "Couper le conteur" : "Écouter le conteur"} position={[-0.35, -0.75, 0]} onClick={() => { if (audio.enabled || audio.busy) audio.stop(); else void audio.start(); }} />
        <WorldButton label={audio.speaking ? "Le conteur parle…" : "Répéter la voix"} position={[0.35, -0.75, 0]} disabled={!audio.enabled || !focus} onClick={audio.repeat} />
        <WorldButton label={AMBIENCE_LABELS[ambience]} position={[-0.35, -1, 0]} onClick={() => onAmbience(nextAmbience(ambience))} />
        <WorldButton label={`Neige · ${snow}%`} position={[0.35, -1, 0]} onClick={() => onSnow(snow >= 100 ? 0 : Math.min(100, snow + 25))} />
        {audio.error && <WorldButton label={audio.error} position={[0, -1.25, 0]} onClick={() => { void audio.start(); }} />}
      </group>
    </XROrigin>
    <group ref={soundModel}>{children(land)}</group>
  </>;
}

function ARPlacement({ children, scale, onScale, focus, note, step, count, onStep, ambience, onAmbience, snow, onSnow }: ImmersiveProps & { children: ReactNode }) {
  const session = useXR(s => s.session);
  const xrStore = useXRStore();
  const camera = useThree(s => s.camera);
  const fallback = useRef<THREE.Group>(null);
  const anchor = useRef<XRAnchor | null>(null);
  const generation = useRef(0);
  const pendingPlace = useRef(false);
  const [rotation, setRotation] = useState(0);
  const [tracking, setTracking] = useState(false);
  const model = useRef<THREE.Group>(null);
  const soundModel = useRef<THREE.Group>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const reticle = useRef<THREE.Mesh>(null);
  const candidate = useRef(new THREE.Matrix4());
  const valid = useRef(false);
  const [found, setFound] = useState(false);
  const [placed, setPlaced] = useState(false);
  const placedRef = useRef(false);
  const audio = useImmersiveAudio(soundModel, placed && !tracking, focus, note, step, count);
  const world = useMemo(() => new THREE.Matrix4(), []);
  const ring = useMemo(() => new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2), []);
  useEffect(() => () => ring.dispose(), [ring]);
  useEffect(() => () => { generation.current++; anchor.current?.delete(); anchor.current = null; }, []);
  useEffect(() => {
    const element = overlay;
    if (!element) return;
    const block = (event: Event) => event.preventDefault();
    element.addEventListener("beforexrselect", block);
    return () => element.removeEventListener("beforexrselect", block);
  }, [overlay]);
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
  useFrame((_, __, frame) => {
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
    <mesh ref={reticle} geometry={ring} matrixAutoUpdate={false} visible={false} onClick={place}>
      <meshBasicMaterial color="gold" side={THREE.DoubleSide} />
    </mesh>
    <group ref={model} visible={false}><group ref={soundModel} scale={scaleForAR(scale)} rotation-y={rotation}>{children}</group></group>
    {!session?.domOverlayState && <group ref={fallback}>
      <WorldButton label={placed ? "Repositionner" : found ? "Poser le village" : "Recherche de surface…"} position={[0, -0.25, -1.2]} disabled={!placed && !found} onClick={placed ? reposition : place} />
      {placed && <>
        <WorldButton label="− Taille" position={[-0.35, -0.5, -1.2]} onClick={() => onScale(scaleForAR(scale - 0.005))} />
        <WorldButton label="+ Taille" position={[0.35, -0.5, -1.2]} onClick={() => onScale(scaleForAR(scale + 0.005))} />
        <WorldButton label="Tourner" position={[0, -0.75, -1.2]} onClick={() => setRotation(value => value + AR_ROTATION_STEP)} />
        {focus && <><WorldButton label="Précédent" position={[-0.35, 0, -1.2]} disabled={step === 0} onClick={() => onStep(-1)} /><WorldButton label="Suivant" position={[0.35, 0, -1.2]} disabled={step === count - 1} onClick={() => onStep(1)} /></>}
      </>}
      <WorldButton label="Quitter l’AR" position={[0, 0.25, -1.2]} onClick={() => { void session?.end(); }} />
      {placed && <><WorldButton label={AMBIENCE_LABELS[ambience]} position={[-0.35, -1, -1.2]} onClick={() => onAmbience(nextAmbience(ambience))} /><WorldButton label={`Neige · ${snow}%`} position={[0.35, -1, -1.2]} onClick={() => onSnow(snow >= 100 ? 0 : Math.min(100, snow + 25))} /></>}
      {placed && <><WorldButton label={audio.enabled || audio.busy ? "Couper le conteur" : "Écouter le conteur"} position={[0, 0.5, -1.2]} onClick={() => { if (audio.enabled || audio.busy) audio.stop(); else void audio.start(); }} />
        {audio.enabled && focus && <WorldButton label="Répéter la voix" position={[0, 0.75, -1.2]} onClick={audio.repeat} />}
        {audio.error && <WorldButton label={audio.error} position={[0, 1, -1.2]} onClick={() => { void audio.start(); }} />}</>}
    </group>}
    <XRDomOverlay className="pointer-events-none fixed inset-0 flex items-end justify-center p-4">
      <div ref={setOverlay} className="pointer-events-auto max-h-[80dvh] w-full max-w-sm space-y-3 overflow-y-auto rounded-lg bg-card/95 p-4 text-card-foreground">
        <p className="font-semibold">{tracking ? "Suivi interrompu…" : placed ? "Village de Noël · Maquette" : found ? "Surface détectée" : "Recherche d’une surface horizontale…"}</p>
        {placed ? <>
          <WeatherControls ambience={ambience} onAmbience={onAmbience} snow={snow} onSnow={onSnow} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={tracking} onClick={() => { if (audio.enabled || audio.busy) audio.stop(); else void audio.start(); }}><span className="flex items-center gap-2">{audio.enabled ? <VolumeX /> : <Volume2 />}{audio.busy ? "Chargement des sons…" : audio.enabled ? "Couper le conteur" : "Écouter le conteur"}</span></Button>
            <Button variant="outline" size="icon" disabled={!audio.enabled || !focus} onClick={audio.repeat} aria-label="Répéter la narration" title="Répéter la narration"><RotateCcw /></Button>
            {audio.speaking && <span className="text-xs text-muted-foreground" aria-live="polite">Le conteur parle…</span>}
          </div>
          {audio.error && <p role="alert" className="text-sm text-destructive">{audio.error}</p>}
          <label className="block text-sm">Taille de la maquette<input aria-label="Taille de la maquette" type="range" min="0.015" max="0.05" step="0.001" value={scale} onChange={e => onScale(Number(e.target.value))} className="mt-2 w-full accent-primary" /></label>
          <label className="block text-sm">Orientation<input aria-label="Orientation de la maquette" type="range" min="0" max="360" step="5" value={(rotation * 180 / Math.PI) % 360} onChange={e => setRotation(Number(e.target.value) * Math.PI / 180)} className="mt-2 w-full accent-primary" /></label>
          {focus && <><p className="text-sm">{step + 1}/{count} · {focus.name}</p><div className="flex gap-2"><Button disabled={step === 0} onClick={() => onStep(-1)}>Précédent</Button><Button disabled={step === count - 1} onClick={() => onStep(1)}>Suivant</Button></div></>}
          <Button variant="secondary" onClick={reposition}>Repositionner</Button>
        </> : <Button disabled={!found} onClick={place}>Poser le village</Button>}
        <Button variant="outline" className="ml-2" onClick={() => { void session?.end(); }}>Quitter l’AR</Button>
      </div>
    </XRDomOverlay>
  </>;
}

export default function ImmersiveVillage(props: ImmersiveProps & {
  renderScene: (mode: "desktop" | "vr" | "ar", teleport?: (point: GroundPosition) => void) => ReactNode;
}) {
  const mode = useXR(s => s.mode);
  if (mode === "immersive-vr") return <VRNavigation {...props}>{teleport => props.renderScene("vr", teleport)}</VRNavigation>;
  if (mode === "immersive-ar") return <ARPlacement {...props}>{props.renderScene("ar")}</ARPlacement>;
  return <>{props.renderScene("desktop")}</>;
}