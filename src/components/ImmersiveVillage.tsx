import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { XROrigin, XRDomOverlay, useXR, useXRStore, useXRHitTest, useXRControllerLocomotion } from "@react-three/xr";
import * as THREE from "three";
import { PLACES, type Place } from "@/lib/village-places";
import { SNAP_DEGREES, VR_WORLD_SCALE, WALK_MAX_DELTA, walkingTarget, walkingVelocity, walkOnGround, safeLanding, viewpoint, type GroundPosition, type WalkVelocity } from "@/lib/xr-navigation";
import { Button } from "@/components/ui/button";

export type ImmersiveProps = {
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

function VRNavigation({ focus, note, step, count, onStep, children }: ImmersiveProps & {
  children: (teleport: (point: GroundPosition) => void) => ReactNode;
}) {
  const origin = useRef<THREE.Group>(null);
  const camera = useThree(s => s.camera);
  const session = useXR(s => s.session);
  const [smooth, setSmooth] = useState(false);
  const [spot, setSpot] = useState(0);
  const heading = useRef<THREE.Group>(null);
  const xrStore = useXRStore();
  const velocity = useRef<WalkVelocity>({ x: 0, z: 0 });
  const lastFacing = useRef<WalkVelocity>({ x: 0, z: -1 });
  const headPosition = useMemo(() => new THREE.Vector3(), []);
  const headDirection = useMemo(() => new THREE.Vector3(), []);
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
  useXRControllerLocomotion((_, angle, delta) => {
    // The library reports a per-frame angle; cap smooth turning after a stalled frame.
    turn(smooth ? -angle * Math.min(delta, WALK_MAX_DELTA) / Math.max(delta, 0.001) : angle);
  }, false, smooth ? { type: "smooth", speed: 1 } : { type: "snap", degrees: SNAP_DEGREES });

  function land(point: GroundPosition) {
    if (!origin.current || !safeLanding(point[0], point[2])) return;
    velocity.current = { x: 0, z: 0 };
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
      </group>
    </XROrigin>
    {children(land)}
  </>;
}

function ARPlacement({ children, scale, onScale, focus, step, count, onStep }: ImmersiveProps & { children: ReactNode }) {
  const session = useXR(s => s.session);
  const model = useRef<THREE.Group>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const reticle = useRef<THREE.Mesh>(null);
  const candidate = useRef(new THREE.Matrix4());
  const valid = useRef(false);
  const [found, setFound] = useState(false);
  const [placed, setPlaced] = useState(false);
  const placedRef = useRef(false);
  const world = useMemo(() => new THREE.Matrix4(), []);
  const ring = useMemo(() => new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2), []);
  useEffect(() => () => ring.dispose(), [ring]);
  useEffect(() => {
    const element = overlay.current;
    if (!element) return;
    const block = (event: Event) => event.preventDefault();
    element.addEventListener("beforexrselect", block);
    return () => element.removeEventListener("beforexrselect", block);
  }, []);
  useXRHitTest((results, getWorldMatrix) => {
    if (placedRef.current) return;
    const result = results[0];
    valid.current = !!result && getWorldMatrix(world, result);
    // Only horizontal surfaces are suitable for the miniature village.
    if (valid.current && (world.elements[5] ?? 0) < 0.9) valid.current = false;
    if (valid.current) candidate.current.copy(world);
    setFound(previous => previous === valid.current ? previous : valid.current);
    if (reticle.current) {
      reticle.current.visible = valid.current;
      reticle.current.matrix.copy(candidate.current);
    }
  }, "viewer", "plane");
  function place() {
    if (!valid.current || placedRef.current || !model.current) return;
    model.current.position.setFromMatrixPosition(candidate.current);
    model.current.visible = true;
    placedRef.current = true;
    setPlaced(true);
    if (reticle.current) reticle.current.visible = false;
  }
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
    <group ref={model} visible={false} scale={scale}>{children}</group>
    <XRDomOverlay className="pointer-events-none fixed inset-0 flex items-end justify-center p-4">
      <div ref={overlay} className="pointer-events-auto w-full max-w-sm space-y-3 rounded-lg bg-card/95 p-4 text-card-foreground">
        <p className="font-semibold">{placed ? "Village de Noël · Maquette" : found ? "Surface détectée" : "Recherche d’une surface horizontale…"}</p>
        {placed ? <>
          <label className="block text-sm">Taille de la maquette<input aria-label="Taille de la maquette" type="range" min="0.015" max="0.05" step="0.001" value={scale} onChange={e => onScale(Number(e.target.value))} className="mt-2 w-full accent-primary" /></label>
          {focus && <><p className="text-sm">{step + 1}/{count} · {focus.name}</p><div className="flex gap-2"><Button disabled={step === 0} onClick={() => onStep(-1)}>Précédent</Button><Button disabled={step === count - 1} onClick={() => onStep(1)}>Suivant</Button></div></>}
          <Button variant="secondary" onClick={() => { placedRef.current = false; valid.current = false; setPlaced(false); setFound(false); if (model.current) model.current.visible = false; }}>Repositionner</Button>
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