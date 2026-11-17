import { useMemo } from "react";
import * as THREE from "three";
import type { Place } from "@/lib/village-places";
import { seeded, type ChaletVariant, type FacadeColor } from "@/lib/village-props";
import { ChimneySmoke, useWeatherColors } from "../VillageWeather";
import { box, useLabelTexture, useMerged, useTintedMerge, type Part } from "./geometry";

type Props = {
  place: Place;
  variant: ChaletVariant;
  facade: FacadeColor;
  seed: number;
  rotation: number;
  shadows: boolean;
};

// Walls ≤ 2.6 × 1.8 m, roof snow caps ≤ 3.0 × 2.3 m; the flat snow drift at the foot reaches 3.4 × 2.7 m, an ellipse
// that still fits the 1.8 m collision radius around place.pos. Doors are 2 m, the scale cue.
const DIMS = {
  gable: { w: 2.6, h: 2.3, d: 1.8, pitch: (40 * Math.PI) / 180, overhang: 0.15 },
  storey: { w: 2.4, h: 3.0, d: 1.8, pitch: (35 * Math.PI) / 180, overhang: 0.15 },
  aframe: { w: 2.6, h: 3.4, d: 1.6, pitch: Math.atan2(3.4, 1.3), overhang: 0.3 },
};

/** A triangle in the (across, up) plane, extruded `length` along the ridge axis and centred. */
function gable(
  halfSpan: number,
  rise: number,
  length: number,
  axis: "x" | "z",
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, 0);
  shape.lineTo(halfSpan, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -length / 2);
  if (axis === "x") geometry.rotateY(-Math.PI / 2); // extrusion along X, triangle spans Z
  return geometry;
}

/** One roof plane descending from the ridge toward `side`; `axis` is the ridge direction. */
function slab(
  width: number,
  run: number,
  ridgeY: number,
  pitch: number,
  side: 1 | -1,
  axis: "x" | "z",
  thickness: number,
  lift: number,
): Part {
  const length = run / Math.cos(pitch);
  const mid = length / 2;
  const y = ridgeY - mid * Math.sin(pitch) + lift / Math.cos(pitch);
  const along = side * mid * Math.cos(pitch);
  return axis === "x"
    ? {
        geometry: box(width, thickness, length, 0.04),
        position: [0, y, along],
        rotation: [side * pitch, 0, 0],
      }
    : {
        geometry: box(length, thickness, width, 0.04),
        position: [along, y, 0],
        rotation: [0, 0, -side * pitch],
      };
}

export default function Chalet({ place, variant, facade, seed, rotation, shadows }: Props) {
  const colors = useWeatherColors();
  const dims = DIMS[variant];
  const random = useMemo(() => seeded(seed), [seed]);
  const chimneyX = useMemo(
    () => (variant === "aframe" ? 0 : 0.6) + (random() - 0.5) * 0.4,
    [random, variant],
  );
  const facadeColor = useMemo(
    () =>
      (colors[facade] ?? new THREE.Color())
        .clone()
        .offsetHSL((seeded(seed + 100)() - 0.5) * 0.06, 0, 0),
    [colors, facade, seed],
  );
  const { w, h, d, pitch, overhang } = dims;
  const axis: "x" | "z" = variant === "aframe" ? "z" : "x";
  const halfRun = variant === "aframe" ? w / 2 : d / 2;
  const ridgeY = variant === "aframe" ? h : h + halfRun * Math.tan(pitch);
  // The door faces +Z, toward the tree once rotated; the A-frame gable is extruded 0.2 m shorter than d.
  const depth = variant === "aframe" ? d - 0.2 : d;
  const front = depth / 2;
  const chimneyTop = ridgeY + 0.55;
  const chimneyZ = variant === "aframe" ? 0 : -0.3;

  // Walls, snow, wood and wreath in one vertex-coloured geometry: one draw call (and one shadow call) per chalet.
  const wallParts = (): Part[] =>
    variant === "aframe"
      ? [{ geometry: gable(w / 2 - 0.08, h - 0.1, d - 0.2, "z") }]
      : [
          { geometry: box(w, h, d, 0.06), position: [0, h / 2, 0] },
          { geometry: gable(d / 2, ridgeY - h, w - 0.1, "x"), position: [0, h, 0] },
        ];

  const whiteParts = () => {
    const parts: Part[] = [];
    // Snow caps only: the roof planes themselves are wood, so the white reads as a layer on top.
    for (const side of [1, -1] as const)
      parts.push(
        slab(
          axis === "x" ? w + 0.4 : d + 2 * overhang + 0.1,
          halfRun + overhang + 0.05,
          ridgeY + 0.02,
          pitch,
          side,
          axis,
          0.12,
          0.2,
        ),
      );
    parts.push({
      geometry: box(0.55, 0.1, 0.55, 0.03),
      position: [chimneyX, chimneyTop + 0.05, chimneyZ],
    });
    parts.push({
      geometry: new THREE.SphereGeometry(1, 14, 8),
      position: [0, 0, 0],
      scale: [w / 2 + 0.4, 0.25, d / 2 + 0.45],
    });
    return parts;
  };

  const woodParts = () => {
    const parts: Part[] = [
      {
        geometry: box(0.45, chimneyTop - ridgeY + 1.2, 0.45, 0.03),
        position: [chimneyX, chimneyTop - (chimneyTop - ridgeY + 1.2) / 2, chimneyZ],
      },
      { geometry: box(1.0, 2.1, 0.07, 0.02), position: [0, 1.05, front - 0.01] },
      { geometry: box(0.86, 1.96, 0.1, 0.02), position: [0, 0.98, front + 0.02] },
    ];
    for (const side of [1, -1] as const)
      parts.push(
        slab(
          axis === "x" ? w + 0.3 : d + 2 * overhang,
          halfRun + overhang,
          ridgeY,
          pitch,
          side,
          axis,
          0.12,
          0.06,
        ),
      );
    for (const [x, y, z, ry, size] of windowSlots(variant, w, depth))
      parts.push({
        geometry: box(size + 0.14, size + 0.14, 0.07, 0.02),
        position: [x, y, z],
        rotation: [0, ry, 0],
      });
    if (variant === "storey") {
      // Balcony above the door, under the upper windows.
      parts.push({ geometry: box(1.6, 0.1, 0.5, 0.02), position: [0, 2.1, front + 0.25] });
      for (const x of [-0.78, -0.26, 0.26, 0.78])
        parts.push({ geometry: box(0.06, 0.6, 0.06, 0.01), position: [x, 2.45, front + 0.47] });
      parts.push({ geometry: box(1.6, 0.06, 0.06, 0.01), position: [0, 2.75, front + 0.47] });
    }
    return parts;
  };
  const wreath = (): Part[] => [
    {
      geometry: new THREE.TorusGeometry(0.2, 0.05, 6, 16),
      position: [0, 2.08, front + 0.1],
      rotation: [Math.PI / 2, 0, 0],
    },
  ];
  const body = useTintedMerge(
    () => [wallParts(), whiteParts(), woodParts(), wreath()],
    [variant, chimneyX],
    [facadeColor, colors["snow"], colors["wood"], colors["needle-dark"]],
  );

  const panes = useMerged(
    () =>
      windowSlots(variant, w, depth).map(([x, y, z, ry, size]) => ({
        geometry: new THREE.PlaneGeometry(size, size),
        position: [x + 0.045 * Math.sin(ry), y, z + 0.045 * Math.cos(ry)] as [
          number,
          number,
          number,
        ],
        rotation: [0, ry, 0] as [number, number, number],
      })),
    [variant],
  );

  const label = useLabelTexture(place.name.replace(/^(Le |La |L')/u, ""));
  // The storey sign hangs on the balcony front; the A-frame sign hangs under the ridge overhang.
  const signY = variant === "storey" ? 2.18 : variant === "aframe" ? 2.45 : 2.15;
  const signZ =
    variant === "storey" ? front + 0.51 : variant === "aframe" ? front + 0.32 : front + 0.06;

  return (
    <group position={[place.pos[0], 0, place.pos[2]]} rotation-y={rotation}>
      <mesh geometry={body} castShadow={shadows} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <mesh geometry={panes}>
        <meshBasicMaterial color={colors["lantern"] ?? new THREE.Color()} toneMapped={false} />
      </mesh>
      <mesh position={[variant === "aframe" ? 0.55 : 0.75, 2.12, front + 0.1]}>
        <boxGeometry args={[0.14, 0.18, 0.14]} />
        <meshBasicMaterial color={colors["lantern"] ?? new THREE.Color()} toneMapped={false} />
      </mesh>
      <mesh position={[0, signY, signZ]}>
        <planeGeometry args={[0.9, 0.24]} />
        <meshBasicMaterial map={label ?? null} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <group position={[chimneyX - 0.55, chimneyTop - 2.55, chimneyZ + 0.3]}>
        <ChimneySmoke />
      </group>
    </group>
  );
}

/** Window centres as [x, y, z, yaw, size]: two on the front beside the door frame, one on each side; the storey adds two upstairs. */
function windowSlots(
  variant: ChaletVariant,
  w: number,
  d: number,
): [number, number, number, number, number][] {
  const front = d / 2 + 0.01,
    side = w / 2 + 0.01;
  if (variant === "aframe")
    return [
      [0, 2.3, front, 0, 0.5],
      [0, 1.4, -front - 0.02, Math.PI, 0.7],
    ];
  const y = variant === "storey" ? 1.3 : 1.45;
  const slots: [number, number, number, number, number][] = [
    [-0.85, y, front, 0, 0.7],
    [0.85, y, front, 0, 0.7],
    [side, 1.4, 0, Math.PI / 2, 0.7],
    [-side, 1.4, 0, -Math.PI / 2, 0.7],
  ];
  if (variant === "storey") slots.push([-0.85, 2.55, front, 0, 0.55], [0.85, 2.55, front, 0, 0.55]);
  return slots;
}
