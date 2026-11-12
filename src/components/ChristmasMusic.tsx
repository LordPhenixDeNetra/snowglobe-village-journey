import { useEffect, useRef, useState } from "react";
import { Music2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import musicAsset from "@/assets/audio/christmas-music.mp3.asset.json";
import { getVillageMixer, setMusicVolume } from "@/lib/audio-mixer";

declare global {
  interface Window {
    __christmasAudio?: () => { playing: boolean; time: number; rms: number; peak: number };
  }
}

export default function ChristmasMusic() {
  const audio = useRef<HTMLAudioElement>(null);
  const mixer = useRef<{ context: AudioContext; gain: GainNode; analyser: AnalyserNode } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(35);
  const [error, setError] = useState(false);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) { audio.current?.pause(); setPlaying(false); }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    if (import.meta.env.DEV) window.__christmasAudio = () => {
      const samples = new Float32Array(1024);
      mixer.current?.analyser.getFloatTimeDomainData(samples);
      return {
        playing: audio.current ? !audio.current.paused : false,
        time: audio.current?.currentTime ?? 0,
        rms: Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length),
        peak: samples.reduce((peak, x) => Math.max(peak, Math.abs(x)), 0),
      };
    };
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      audio.current?.pause();
      delete window.__christmasAudio;
    };
  }, []);

  async function toggle() {
    const element = audio.current;
    if (!element) return;
    if (playing) { element.pause(); setPlaying(false); return; }
    setError(false);
    try {
      if (!mixer.current) {
        const shared = getVillageMixer();
        const context = shared.context;
        const source = context.createMediaElementSource(element);
        const gain = shared.music;
        const analyser = shared.analyser;
        source.connect(gain);
        setMusicVolume(volume / 100);
        mixer.current = { context, gain, analyser };
      }
      await mixer.current.context.resume();
      await element.play();
      setPlaying(true);
    } catch { setError(true); setPlaying(false); }
  }

  return (
    <div className="absolute bottom-24 left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg bg-card/90 p-2 text-card-foreground shadow-lg backdrop-blur">
      <audio ref={audio} src={musicAsset.url} loop preload="none" crossOrigin="anonymous" />
      <Button variant="secondary" size="icon" onClick={toggle} aria-pressed={playing}
        aria-label={playing ? "Couper la musique de Noël" : "Activer la musique de Noël"}
        title={playing ? "Couper la musique de Noël" : "Activer la musique de Noël"}>
        {playing ? <Music2 /> : <VolumeX />}
      </Button>
      <label className="flex items-center gap-2 text-xs">
        Noël
        <input type="range" min="0" max="100" value={volume} aria-label="Volume de la musique" className="w-20 accent-primary"
          onChange={(e) => {
            const value = Number(e.target.value);
            setVolume(value);
            setMusicVolume(value / 100);
          }} />
      </label>
      {error && <span role="alert" className="text-xs text-destructive">Musique indisponible, réessayez.</span>}
    </div>
  );
}