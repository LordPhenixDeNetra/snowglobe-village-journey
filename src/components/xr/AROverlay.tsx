import { useEffect, useState } from "react";
import { Box, ChevronLeft, ChevronRight, Compass, Gift, MapPin, Moon, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ActionBar, { type ActionItem } from "@/components/shell/ActionBar";
import ActivityControls, { type ActivityProps } from "@/components/ActivityControls";
import WeatherControls from "@/components/WeatherControls";
import type { Ambience } from "@/lib/village-weather";

export type ARState = {
  placed: boolean; found: boolean; tracking: boolean;
  focusName: string | null; note: string | undefined; step: number; count: number;
  audio: { enabled: boolean; busy: boolean; speaking: boolean; error: string | null };
  scale: number; rotationDeg: number; ambience: Ambience; snow: number; activities: ActivityProps;
};
export type ARActions = {
  place: () => void; reposition: () => void; exit: () => void; onStep: (direction: number) => void;
  startAudio: () => void; stopAudio: () => void; repeat: () => void;
  onScale: (scale: number) => void; onRotation: (degrees: number) => void;
  onAmbience: (value: Ambience) => void; onSnow: (value: number) => void;
};

type ARPanel = "tour" | "activities" | "ambience" | "narrator" | "model";
const ITEMS: ActionItem<ARPanel>[] = [
  { id: "tour", title: "Parcours", icon: Compass },
  { id: "activities", title: "Activités", icon: Gift },
  { id: "ambience", title: "Ambiance", icon: Moon },
  { id: "narrator", title: "Conteur", icon: Volume2 },
  { id: "model", title: "Maquette", icon: Box },
];

// DOM overlay of the AR session: everything renders inside the root so XRDomOverlay can show it.
export default function AROverlay({ state, actions }: { state: ARState; actions: ARActions }) {
  const { placed, found, tracking, focusName, note, step, count, audio } = state;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState<ARPanel | null>(null);
  useEffect(() => {
    if (!root) return;
    // A tap on the overlay must never also fire the session `select` that places the village.
    const block = (event: Event) => event.preventDefault();
    root.addEventListener("beforexrselect", block);
    return () => root.removeEventListener("beforexrselect", block);
  }, [root]);
  const status = tracking ? "Suivi interrompu…" : placed ? null : found ? "Surface détectée" : "Recherche d’une surface horizontale…";
  const listening = audio.enabled || audio.busy;
  const panels: Record<ARPanel, React.ReactNode> = {
    tour: focusName ? <div className="space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Étape {step + 1} / {count}</p>
      <p className="font-heading text-lg font-semibold">{focusName}</p>
      {note && <p className="text-base">{note}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="min-h-11 flex-1" disabled={step === 0} onClick={() => actions.onStep(-1)}><ChevronLeft aria-hidden />Précédent</Button>
        <Button className="min-h-11 flex-1" disabled={step >= count - 1} onClick={() => actions.onStep(1)}>Suivant<ChevronRight aria-hidden /></Button>
      </div>
    </div> : <p className="text-sm text-muted-foreground">Promenade libre : créez un parcours avant d’entrer en AR pour suivre ses étapes.</p>,
    activities: <ActivityControls {...state.activities} />,
    ambience: <WeatherControls ambience={state.ambience} onAmbience={actions.onAmbience} snow={state.snow} onSnow={actions.onSnow} />,
    narrator: <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="min-h-11 flex-1" disabled={tracking} onClick={listening ? actions.stopAudio : actions.startAudio}>
          {audio.enabled ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}{audio.busy ? "Chargement des sons…" : audio.enabled ? "Couper le conteur" : "Écouter le conteur"}
        </Button>
        <Button variant="outline" size="icon" className="min-h-11 min-w-11" disabled={!audio.enabled || !focusName} onClick={actions.repeat} aria-label="Répéter la narration" title="Répéter la narration"><RotateCcw aria-hidden /></Button>
      </div>
      {audio.speaking && <p className="text-sm text-muted-foreground" aria-live="polite">Le conteur parle…</p>}
      {audio.error && <p role="alert" className="text-sm text-destructive">{audio.error}</p>}
    </div>,
    model: <div className="space-y-4">
      <label className="block text-sm">Taille<input aria-label="Taille de la maquette" type="range" min="0.015" max="0.05" step="0.001" value={state.scale} onChange={e => actions.onScale(Number(e.target.value))} className="mt-1 h-11 w-full accent-primary" /></label>
      <label className="block text-sm">Orientation<input aria-label="Orientation de la maquette" type="range" min="0" max="360" step="5" value={state.rotationDeg} onChange={e => actions.onRotation(Number(e.target.value))} className="mt-1 h-11 w-full accent-primary" /></label>
      <Button variant="secondary" className="min-h-11 w-full" onClick={() => { setOpen(null); actions.reposition(); }}><MapPin aria-hidden />Repositionner</Button>
    </div>,
  };
  return <div ref={setRoot} data-testid="ar-overlay" className="pointer-events-none fixed inset-0 text-foreground">
    <div className="absolute inset-x-0 top-0 flex items-start gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))]">
      {status && <p role="status" className="glass min-w-0 rounded-2xl px-4 py-2 text-sm font-semibold">{status}</p>}
      <Button variant="ghost" className="glass pointer-events-auto ml-auto min-h-11 shrink-0 rounded-full" title="Quitter l’AR" onClick={actions.exit}><X aria-hidden />Quitter l’AR</Button>
    </div>
    {placed
      ? <ActionBar<ARPanel> open={open} onOpen={setOpen} items={ITEMS} panels={panels} hunting={state.activities.hunting} found={state.activities.found.length} container={root} brand={false} forceMobile />
      : <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button size="lg" className="pointer-events-auto h-auto min-h-14 w-full max-w-sm rounded-2xl text-lg shadow-lg" disabled={!found} onClick={actions.place}><MapPin aria-hidden />Poser le village</Button>
      </div>}
  </div>;
}
