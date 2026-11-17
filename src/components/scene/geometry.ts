import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type Part = { geometry: THREE.BufferGeometry; position?: [number, number, number]; rotation?: [number, number, number]; scale?: number | [number, number, number] };

/** Chamfered block: the base solid of every cartoon prop. */
export function box(w: number, h: number, d: number, radius = 0.05): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2));
}

/** Bake part transforms and merge into one geometry (one draw call per material). Sources are disposed. */
export function merged(parts: Part[]): THREE.BufferGeometry {
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  const geometries = parts.map(part => {
    const s: [number, number, number] = typeof part.scale === "number" ? [part.scale, part.scale, part.scale] : part.scale ?? [1, 1, 1];
    matrix.compose(position.set(...(part.position ?? [0, 0, 0])), quaternion.setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0]))), scale.set(...s));
    // Extrusions are non-indexed while boxes/cones are indexed; mergeGeometries needs one kind.
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.deleteAttribute("uv2");
    return geometry.applyMatrix4(matrix);
  });
  const result = mergeGeometries(geometries, false);
  geometries.forEach(geometry => geometry.dispose());
  if (!result) throw new Error("mergeGeometries failed: mismatched attributes");
  return result;
}

export function useMerged(build: () => Part[], deps: unknown[]): THREE.BufferGeometry {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => merged(build()), deps);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** Parchment label drawn on a canvas: no font request inside a headset, Fredoka when already loaded. */
export function useLabelTexture(text: string, { width = 512, height = 128, size = 56 }: { width?: number; height?: number; size?: number } = {}): THREE.CanvasTexture | undefined {
  const [texture, setTexture] = useState<THREE.CanvasTexture>();
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const css = getComputedStyle(document.documentElement);
    context.fillStyle = css.getPropertyValue("--parchment").trim();
    context.fillRect(0, 0, width, height);
    context.fillStyle = css.getPropertyValue("--parchment-ink").trim();
    const family = document.fonts?.check(`bold ${size}px Fredoka`) ? "Fredoka" : "sans-serif";
    context.font = `bold ${size}px ${family}`;
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(text, width / 2, height / 2, width - 40);
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    setTexture(next);
    return () => next.dispose();
  }, [text, width, height, size]);
  return texture;
}
