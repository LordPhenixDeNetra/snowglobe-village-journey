import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WEATHER_LIGHT, type Ambience } from "@/lib/village-weather";

const SCENE_TOKENS = [
  "day-sky",
  "dusk-sky",
  "night-sky",
  "day-light",
  "dusk-light",
  "night-light",
  "snow",
  "smoke",
  "gold",
  "red",
  "blue",
  "green",
  "aurora-green",
  "aurora-rose",
  "plum",
  "copper",
  "wood",
  "bark",
  "needle",
  "needle-dark",
  "ice",
  "lantern",
  "path",
  "stone",
  "scarf",
  "fur",
  "fur-light",
  "antler",
  "nose",
  "skin",
];

let cache: Record<string, THREE.Color> | null = null;

/** Reads the --scene-* oklch tokens once through a 1×1 canvas (the browser converts them to sRGB). */
function readSceneColors(): Record<string, THREE.Color> {
  if (cache) return cache;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return {};
  const css = getComputedStyle(document.documentElement);
  const result: Record<string, THREE.Color> = {};
  for (const name of SCENE_TOKENS) {
    ctx.fillStyle = css.getPropertyValue(`--scene-${name}`).trim();
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    result[name] = new THREE.Color().setRGB(
      (data[0] ?? 0) / 255,
      (data[1] ?? 0) / 255,
      (data[2] ?? 0) / 255,
      THREE.SRGBColorSpace,
    );
  }
  cache = result;
  return result;
}

/** Scene colours, available on the very first render so nothing is drawn black for a frame. */
export function useWeatherColors() {
  const [colors] = useState(readSceneColors);
  return colors;
}

export function WeatherLighting({ ambience, ar }: { ambience: Ambience; ar: boolean }) {
  const colors = useWeatherColors();
  const light = WEATHER_LIGHT[ambience];
  const sky = colors[`${ambience}-sky`];
  return (
    <>
      {!ar && sky && (
        <>
          <color attach="background" args={[sky]} />
          <fog attach="fog" args={[sky, 22, 65]} />
        </>
      )}
      <ambientLight
        intensity={light.ambient}
        color={colors[`${ambience}-light`] ?? new THREE.Color()}
      />
      <directionalLight
        position={light.position}
        intensity={light.sun}
        color={colors[`${ambience}-light`] ?? new THREE.Color()}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
      />
      {!ar && <Aurora colors={colors} night={ambience === "night"} />}
    </>
  );
}

// Mounted from the start (outside AR) so its shader compiles at load, not on the first switch to night:
// by day it is drawn once, fully transparent, then hidden.
function Aurora({ colors, night }: { colors: Record<string, THREE.Color>; night: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const warmed = useRef(false);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      strength: { value: 0 },
      green: { value: new THREE.Color() },
      rose: { value: new THREE.Color() },
    }),
    [],
  );
  // R3F copies each uniform into the material's own holder, so live values are written through the
  // material ref (writing `uniforms.x.value` here would never reach the shader).
  useEffect(() => {
    const live = material.current?.uniforms;
    if (!live) return;
    if (colors["aurora-green"]) live["green"]?.value.copy(colors["aurora-green"]);
    if (colors["aurora-rose"]) live["rose"]?.value.copy(colors["aurora-rose"]);
  }, [colors]);
  useFrame((_, dt) => {
    const live = material.current?.uniforms;
    if (live?.["strength"]) live["strength"].value = night ? 1 : 0;
    if (night && live?.["time"]) live["time"].value += Math.min(dt, 0.05);
    if (mesh.current) mesh.current.visible = night || !warmed.current;
    warmed.current = true;
  });
  return (
    <mesh ref={mesh} position={[0, 18, -28]} frustumCulled={false}>
      <planeGeometry args={[110, 24, 100, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        vertexShader={`varying vec2 vUv; uniform float time; void main(){ vUv=uv; vec3 p=position; p.z+=sin(p.x*0.12+time*0.35)*4.; p.y+=sin(p.x*0.09-time*0.22)*2.; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`}
        fragmentShader={`varying vec2 vUv; uniform float time; uniform float strength; uniform vec3 green; uniform vec3 rose; void main(){ float wave=0.35+0.13*sin(vUv.x*12.+time*0.4)+0.06*sin(vUv.x*28.-time*0.6); float curtain=exp(-abs(vUv.y-wave)*7.); float threads=0.6+0.4*sin(vUv.x*160.+sin(vUv.x*19.+time)*3.); float edge=smoothstep(0.,0.12,vUv.x)*smoothstep(0.,0.12,1.-vUv.x); gl_FragColor=vec4(mix(green,rose,smoothstep(0.35,0.9,vUv.y)),curtain*threads*edge*0.65*strength); }`}
      />
    </mesh>
  );
}

export function ChimneySmoke() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const time = useRef(0);
  const object = useMemo(() => new THREE.Object3D(), []);
  const colors = useWeatherColors();
  useFrame((_, dt) => {
    time.current += Math.min(dt, 0.05);
    if (!mesh.current) return;
    for (let i = 0; i < 12; i++) {
      const age = (time.current * 0.17 + i / 12) % 1;
      object.position.set(
        0.55 + age * 0.65 + Math.sin(age * 8 + i) * age * 0.12,
        2.55 + age * 3,
        -0.3 + age * 0.35,
      );
      object.scale.setScalar(0.09 + Math.sin(age * Math.PI) * 0.32);
      object.updateMatrix();
      mesh.current.setMatrixAt(i, object.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 12]} frustumCulled={false}>
      <sphereGeometry args={[1, 7, 6]} />
      <meshStandardMaterial
        color={colors["smoke"] ?? new THREE.Color()}
        transparent
        opacity={0.13}
        depthWrite={false}
        roughness={1}
      />
    </instancedMesh>
  );
}

export function SleighStars({
  position,
  moving,
}: {
  position: () => readonly number[];
  moving: () => boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const particles = useRef(Array.from({ length: 60 }, () => ({ x: 0, y: 0, z: 0, life: 0 })));
  const cursor = useRef(0),
    timer = useRef(0);
  const object = useMemo(() => new THREE.Object3D(), []);
  const colors = useWeatherColors();
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    timer.current += dt;
    if (moving() && timer.current > 0.035) {
      timer.current = 0;
      const p = particles.current[cursor.current];
      const pos = position();
      if (p) {
        p.x = (pos[0] ?? 0) + Math.sin(cursor.current * 2.4) * 0.35;
        p.y = (pos[1] ?? 0) + 0.5;
        p.z = (pos[2] ?? 0) + Math.cos(cursor.current * 2.4) * 0.35;
        p.life = 1.8;
      }
      cursor.current = (cursor.current + 1) % 60;
    }
    if (!mesh.current) return;
    particles.current.forEach((p, i) => {
      p.life = Math.max(0, p.life - dt);
      p.y += dt * 0.12;
      object.position.set(p.x, p.y, p.z);
      object.rotation.set(i, timer.current + p.life * 3, i * 0.4);
      object.scale.setScalar(
        p.life > 0 ? ((0.06 * p.life) / 1.8) * (0.7 + 0.3 * Math.sin(p.life * 16 + i)) : 0,
      );
      object.updateMatrix();
      mesh.current?.setMatrixAt(i, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 60]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={colors["gold"] ?? new THREE.Color()} toneMapped={false} />
    </instancedMesh>
  );
}
