import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

declare global {
  interface Window {
    __villageStats?: () => {
      calls: number;
      triangles: number;
      geometries: number;
      textures: number;
      programs: number;
    };
  }
}

/** Development-only renderer counters for one controlled render of the current view (shadow pass included),
 *  to check the Quest budget. Reading `info` after an arbitrary frame can report an auxiliary pass instead. */
export default function StatsProbe() {
  const { gl, scene, camera } = useThree((state) => ({
    gl: state.gl,
    scene: state.scene,
    camera: state.camera,
  }));
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__villageStats = () => {
      const autoReset = gl.info.autoReset;
      gl.info.autoReset = false;
      gl.info.reset();
      gl.render(scene, camera);
      const result = {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
      };
      gl.info.autoReset = autoReset;
      return result;
    };
    return () => {
      delete window.__villageStats;
    };
  }, [gl, scene, camera]);
  return null;
}
