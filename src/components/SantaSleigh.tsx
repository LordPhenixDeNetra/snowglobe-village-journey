import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import sleighAsset from "@/assets/models/santa-sleigh.glb.asset.json";
import { assetUrl } from "@/lib/static-site";
import {
  SLEIGH_HOME,
  SLEIGH_TRAVEL_SECONDS,
  sleighDestination,
  sleighPosition,
  type SleighPosition,
} from "@/lib/sleigh-motion";
import { SleighStars } from "./VillageWeather";

declare global {
  interface Window {
    __sleigh?: {
      snapshot: () => { position: SleighPosition; target: SleighPosition; progress: number };
      sim: (seconds: number) => void;
    };
  }
}

/** Forget a failed load so the next mount fetches the model again. */
export function forgetSleighModel() {
  useGLTF.clear(assetUrl(sleighAsset));
}

export default function SantaSleigh({ stopId }: { stopId: string | undefined }) {
  const { scene } = useGLTF(assetUrl(sleighAsset));
  const group = useRef<THREE.Group>(null);
  const motion = useRef({
    from: [...SLEIGH_HOME] as SleighPosition,
    to: [...SLEIGH_HOME] as SleighPosition,
    position: [...SLEIGH_HOME] as SleighPosition,
    progress: 1,
  });
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 2.5 / Math.max(size.x, size.z);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return clone;
  }, [scene]);

  useEffect(() => {
    const state = motion.current;
    state.from = [...state.position];
    state.to = (stopId ? sleighDestination(stopId) : SLEIGH_HOME) ?? SLEIGH_HOME;
    state.progress = 0;
  }, [stopId]);

  function advance(dt: number) {
    const state = motion.current;
    state.progress = Math.min(1, state.progress + dt / SLEIGH_TRAVEL_SECONDS);
    state.position = sleighPosition(state.from, state.to, state.progress);
    const object = group.current;
    if (!object) return;
    object.position.set(...state.position);
    const dx = state.to[0] - state.from[0],
      dz = state.to[2] - state.from[2];
    if (Math.hypot(dx, dz) > 0.01) object.rotation.y = Math.atan2(dx, dz);
  }

  useEffect(() => {
    if (import.meta.env.DEV)
      window.__sleigh = {
        snapshot: () => ({
          position: [...motion.current.position],
          target: [...motion.current.to],
          progress: motion.current.progress,
        }),
        sim: (seconds) => {
          for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60)
            advance(Math.min(1 / 60, seconds - elapsed));
        },
      };
    return () => {
      delete window.__sleigh;
    };
  }, []);
  useFrame((_, delta) => advance(Math.min(delta, 0.05)));
  return (
    <>
      <group ref={group} position={SLEIGH_HOME}>
        <primitive object={model} />
      </group>
      <SleighStars
        position={() => motion.current.position}
        moving={() =>
          motion.current.progress < 1 &&
          Math.hypot(
            motion.current.to[0] - motion.current.from[0],
            motion.current.to[2] - motion.current.from[2],
          ) > 0.1
        }
      />
    </>
  );
}
