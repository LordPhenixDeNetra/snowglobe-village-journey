import { useState } from "react";
import type { Place } from "@/lib/village-places";
import { AMBIENCE_LABELS, nextAmbience } from "@/lib/village-weather";
import { vrPanelRows } from "@/lib/xr-panel";
import type { useImmersiveAudio } from "@/hooks/use-ar-audio";
import type { ActivityProps } from "@/components/ActivityControls";
import type { WeatherProps } from "@/components/WeatherControls";
import WorldPanel, { pulse } from "./WorldPanel";

export type ImmersiveAudio = ReturnType<typeof useImmersiveAudio>;

// Shared by the VR panel and the AR world-space fallback.
export function pressShared(id: string, { activities, ambience, onAmbience, snow, onSnow, audio }: WeatherProps & { activities: ActivityProps; audio: ImmersiveAudio }) {
  const { activity, onActivity } = activities;
  const actions: Record<string, () => void> = {
    narrator: () => { if (audio.enabled || audio.busy) audio.stop(); else void audio.start(); },
    repeat: audio.repeat,
    "audio-error": () => { void audio.start(); },
    ambience: () => onAmbience(nextAmbience(ambience)),
    snow: () => onSnow(snow >= 100 ? 0 : Math.min(100, snow + 25)),
    letter: () => onActivity(activity === "letter" ? null : "letter"),
    hunt: () => { if (activity === "hunt") onActivity(null); else { onActivity("hunt"); if (!activities.hunting) activities.onHunt(); } },
    tree: () => onActivity(activity === "tree" ? null : "tree"),
  };
  actions[id]?.();
}

export type VRPanelProps = WeatherProps & {
  focus: Place | null; note: string | undefined; step: number; count: number; onStep: (direction: number) => void;
  onVisit: (place: Place) => void; onViewpoint: () => void; smooth: boolean; onSmooth: (smooth: boolean) => void;
  audio: ImmersiveAudio; activities: ActivityProps; session: XRSession | undefined;
};

// Mounted only inside a VR session, so "Plus…" starts folded on every entry.
export default function VRPanel(props: VRPanelProps) {
  const { focus, note, step, count, onStep, onVisit, onViewpoint, smooth, onSmooth, audio, ambience, snow, activities, session } = props;
  const [more, setMore] = useState(false);
  const rows = vrPanelRows({
    focusName: focus?.name ?? null, note, step, count, more, smooth,
    audio: { enabled: audio.enabled, busy: audio.busy, speaking: audio.speaking, error: audio.error },
    ambienceLabel: AMBIENCE_LABELS[ambience], snow, found: activities.found.length, activity: activities.activity,
  });
  function press(id: string) {
    if (id === "prev") onStep(-1);
    else if (id === "next") onStep(1);
    else if (id === "stop") { if (focus) onVisit(focus); }
    else if (id === "viewpoint") onViewpoint();
    else if (id === "more") setMore(!more);
    else if (id === "rotation") onSmooth(!smooth);
    else if (id === "exit") void session?.end();
    else pressShared(id, props);
    // "stop" and "viewpoint" move the visitor: land() already pulses for them.
    if (id !== "stop" && id !== "viewpoint") pulse(session);
  }
  // 0.6 keeps the canvas text at today's physical size (≈4 cm) while the wider hierarchy stays in view at 1.4 m.
  return <WorldPanel rows={rows} onPress={press} title={focus ? note || focus.name : "Village de Noël"} position={[0, 0.4, 0]} scale={0.6} />;
}
