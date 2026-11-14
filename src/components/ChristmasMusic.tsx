import { useEffect, useRef, useState, type RefObject } from "react";
import { Music2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import musicAsset from "@/assets/audio/christmas-music.mp3.asset.json";
import { getVillageMixer, setMusicVolume } from "@/lib/audio-mixer";

declare global {
  interface Window {
    __christmasAudio?: () => { playing: boolean; time: number; rms: number; peak: number };
  }
}

export type ChristmasMusic = { audioRef: RefObject<HTMLAudioElement | null>; playing: boolean; volume: number; error: boolean; toggle: () => Promise<void>; setVolume: (value: number) => void };

// The hook owns playback state; the <audio> element stays mounted by the page so closing a panel never cuts the music.
export function useChristmasMusic(): ChristmasMusic {
  const audioRef = useRef<HTMLAudioElement>(null);
  const mixer = useRef<{ context: AudioContext; analyser: AnalyserNode } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(35);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = audioRef.current;
    const pauseWhenHidden = () => {
      if (document.hidden) { element?.pause(); setPlaying(false); }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    if (import.meta.env.DEV) window.__christmasAudio = () => {
      const samples = new Float32Array(1024);
      mixer.current?.analyser.getFloatTimeDomainData(samples);
      return {
        playing: audioRef.current ? !audioRef.current.paused : false,
        time: audioRef.current?.currentTime ?? 0,
        rms: Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length),
        peak: samples.reduce((peak, x) => Math.max(peak, Math.abs(x)), 0),
      };
    };
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      element?.pause();
      delete window.__christmasAudio;
    };
  }, []);

  async function toggle() {
    const element = audioRef.current;
    if (!element) return;
    if (playing) { element.pause(); setPlaying(false); return; }
    setError(false);
    try {
      if (!mixer.current) {
        const shared = getVillageMixer();
        shared.context.createMediaElementSource(element).connect(shared.music);
        setMusicVolume(volume / 100);
        mixer.current = { context: shared.context, analyser: shared.analyser };
      }
      await mixer.current.context.resume();
      await element.play();
      setPlaying(true);
    } catch { setError(true); setPlaying(false); }
  }
  function setVolume(value: number) { setVolumeState(value); setMusicVolume(value / 100); }
  return { audioRef, playing, volume, error, toggle, setVolume };
}

export function MusicAudio({ audioRef }: { audioRef: RefObject<HTMLAudioElement | null> }) {
  return <audio ref={audioRef} src={musicAsset.url} loop preload="none" crossOrigin="anonymous" />;
}

export function MusicControls({ playing, volume, error, toggle, setVolume }: ChristmasMusic) {
  return <div className="space-y-3">
    <Button variant={playing ? "default" : "secondary"} className="min-h-11 w-full text-base" onClick={() => { void toggle(); }} aria-pressed={playing}>
      {playing ? <Music2 aria-hidden /> : <VolumeX aria-hidden />}{playing ? "Couper la musique de Noël" : "Activer la musique de Noël"}
    </Button>
    <div className="flex items-center gap-3 text-sm"><span>Volume</span><Slider aria-label="Volume de la musique" min={0} max={100} step={1} value={[volume]} onValueChange={([value]) => setVolume(value ?? volume)} className="min-w-0 flex-1" /><span className="w-10 text-right tabular-nums">{volume}%</span></div>
    <p className="text-xs text-muted-foreground">Musique sous licence, lancée uniquement sur votre geste.</p>
    {error && <p role="alert" className="text-sm text-destructive">Musique indisponible, réessayez.</p>}
  </div>;
}
