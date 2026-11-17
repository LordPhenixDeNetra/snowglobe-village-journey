import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { PANEL_BUTTON, panelLayout, wrapLabel, type PanelButton } from "@/lib/xr-panel";

const PX = 800; // canvas pixels per metre: 52 px text on a 0.21 m button
const TEXT = 52;
const PAD = 0.06;
const TITLE = 0.24;

export function pulse(session: XRSession | undefined) {
  const input = Array.from(session?.inputSources ?? []).find(
    (source) => source.gamepad?.hapticActuators?.length,
  );
  const actuator = input?.gamepad?.hapticActuators?.[0];
  if (actuator) void actuator.pulse(0.25, 35).catch(() => {});
}

const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Fredoka only when already loaded: the headset never waits for a remote font.
const font = (size: number) =>
  `600 ${size}px ${document.fonts?.check(`600 ${size}px Fredoka`) ? "Fredoka, " : ""}sans-serif`;

// Redraw once the page fonts have loaded: a label drawn earlier keeps the sans-serif fallback otherwise.
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}

// One canvas and texture per element, redrawn only when `key` (or the font state) changes and released on unmount.
function useCanvasTexture(
  width: number,
  height: number,
  key: string,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    return next;
  }, [width, height]);
  useEffect(() => () => texture.dispose(), [texture]);
  const fonts = useFontsReady();
  useEffect(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(ctx, canvas.width, canvas.height);
    texture.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything `draw` reads.
  }, [texture, key, fonts]);
  return texture;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  maxWidth: number,
) {
  ctx.font = font(TEXT);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) =>
    ctx.fillText(line, x, y + (i - (lines.length - 1) / 2) * TEXT * 1.15, maxWidth),
  );
}

const charsFor = (pixels: number) => Math.floor(pixels / (TEXT * 0.55));

function PanelKey({
  button,
  position,
  width,
  onPress,
}: {
  button: PanelButton;
  position: [number, number];
  width: number;
  onPress: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const active = hover && !button.disabled;
  const texture = useCanvasTexture(
    Math.round(width * PX),
    Math.round(PANEL_BUTTON[1] * PX),
    `${button.label}|${button.pressed}|${active}`,
    (ctx, w, h) => {
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 36);
      ctx.fillStyle = token(button.pressed ? "--primary" : active ? "--accent" : "--muted");
      ctx.fill();
      ctx.lineWidth = active ? 8 : 3;
      ctx.strokeStyle = token(active ? "--ring" : "--border");
      ctx.stroke();
      ctx.fillStyle = token(button.pressed ? "--primary-foreground" : "--foreground");
      drawLines(ctx, wrapLabel(button.label, charsFor(w - 48), 2), w / 2, h / 2, w - 48);
    },
  );
  // renderOrder above the glass: transparent corners must not cut holes in it when sorting puts the glass last.
  return (
    <mesh
      position={[position[0], position[1], 0.005]}
      scale={active ? 1.05 : 1}
      renderOrder={1}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (!button.disabled) onPress(button.id);
      }}
    >
      <planeGeometry args={[width, PANEL_BUTTON[1]]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={button.disabled ? 0.4 : 1}
        toneMapped={false}
      />
    </mesh>
  );
}

function PanelTitle({ text, width, y }: { text: string; width: number; y: number }) {
  const texture = useCanvasTexture(
    Math.round(width * PX),
    Math.round(TITLE * PX),
    text,
    (ctx, w, h) => {
      ctx.fillStyle = token("--foreground");
      drawLines(ctx, wrapLabel(text, charsFor(w - 48), 2), w / 2, h / 2, w - 48);
    },
  );
  return (
    <mesh position={[0, y, 0.003]} renderOrder={1}>
      <planeGeometry args={[width, TITLE]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

// Glass panel grouping canvas buttons. `position` is the top centre, so opening rows grows the panel downward.
export default function WorldPanel({
  rows,
  onPress,
  position = [0, 0, 0],
  title,
  scale = 1,
}: {
  rows: PanelButton[][];
  onPress: (id: string) => void;
  position?: [number, number, number];
  title?: string;
  scale?: number;
}) {
  const layout = panelLayout(rows);
  const buttons = new Map(rows.flat().map((button) => [button.id, button]));
  const titleHeight = title ? TITLE : 0;
  const width = layout.width + 2 * PAD,
    height = layout.height + 2 * PAD + titleHeight;
  const background = useCanvasTexture(
    Math.round(width * 200),
    Math.round(height * 200),
    "glass",
    (ctx, w, h) => {
      ctx.beginPath();
      ctx.roundRect(3, 3, w - 6, h - 6, 16);
      ctx.fillStyle = token("--card");
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = token("--border");
      ctx.stroke();
    },
  );
  return (
    <group position={[position[0], position[1] - (height * scale) / 2, position[2]]} scale={scale}>
      {/* The glass catches rays so a miss between buttons never reaches the scene behind. */}
      <mesh onClick={(e) => e.stopPropagation()}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={background} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {title && <PanelTitle text={title} width={layout.width} y={height / 2 - PAD - TITLE / 2} />}
      <group position={[0, -titleHeight / 2, 0]}>
        {layout.map((item) => {
          const button = buttons.get(item.id);
          return (
            button && (
              <PanelKey
                key={item.id}
                button={button}
                position={item.position}
                width={item.width}
                onPress={onPress}
              />
            )
          );
        })}
      </group>
    </group>
  );
}
