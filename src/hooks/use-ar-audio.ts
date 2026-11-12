import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getVillageMixer, duckMusic } from "@/lib/audio-mixer";
import { AR_SOUND_POSITIONS, narrationForStop } from "@/lib/ar-audio";
import type { Place } from "@/lib/village-places";
import bells from "@/assets/audio/bells.mp3.asset.json";
import fire from "@/assets/audio/fireplace.mp3.asset.json";

type Sound = { source: AudioBufferSourceNode; panner: PannerNode };
export function useARAudio(model: RefObject<THREE.Group | null>, active: boolean, focus: Place | null, note: string | undefined, step: number, count: number) {
  const camera = useThree(state => state.camera);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sounds = useRef<Sound[]>([]);
  const generation = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const buffers = useRef<AudioBuffer[]>([]);
  const starting = useRef(false);
  const text = narrationForStop(focus, note, step, count);
  const position = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Quaternion());

  const cancelVoice = useCallback(() => {
    if (utterance.current) {
      utterance.current.onend = null; utterance.current.onerror = null;
      window.speechSynthesis?.cancel(); utterance.current = null;
    }
    duckMusic(false); setSpeaking(false);
  }, []);
  const stop = useCallback(() => {
    generation.current++;
    starting.current = false;
    sounds.current.forEach(sound => { sound.source.stop(); sound.source.disconnect(); sound.panner.disconnect(); });
    sounds.current = [];
    cancelVoice(); setEnabled(false); setBusy(false);
  }, [cancelVoice]);
  const repeat = useCallback(() => {
    cancelVoice();
    if (!text) return;
    if (!("speechSynthesis" in window)) { setError("La voix n’est pas disponible dans ce navigateur."); return; }
    const voice = new SpeechSynthesisUtterance(text);
    voice.lang = "fr-FR"; voice.rate = 0.88; voice.pitch = 0.95; voice.volume = 0.9;
    const french = window.speechSynthesis.getVoices().find(item => item.lang.startsWith("fr"));
    if (french) voice.voice = french;
    voice.onstart = () => { setSpeaking(true); duckMusic(true); };
    voice.onend = () => { setSpeaking(false); duckMusic(false); utterance.current = null; };
    voice.onerror = () => { setSpeaking(false); duckMusic(false); setError("La narration n’a pas démarré. Réessayez la voix."); utterance.current = null; };
    utterance.current = voice;
    window.speechSynthesis.speak(voice);
  }, [text, cancelVoice]);
  const start = useCallback(async () => {
    if (starting.current || enabled || !active) return;
    starting.current = true;
    const request = ++generation.current;
    setBusy(true); setError(null);
    // Speech starts in the tap itself, before awaiting recordings, for mobile gesture policies.
    try {
      const mixer = getVillageMixer();
      repeat();
      await mixer.context.resume();
      if (!buffers.current.length) buffers.current = await Promise.all([bells.url, fire.url].map(async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Audio unavailable");
        return mixer.context.decodeAudioData(await response.arrayBuffer());
      }));
      if (request !== generation.current) return;
      buffers.current.forEach((buffer, index) => {
        const source = mixer.context.createBufferSource();
        source.buffer = buffer; source.loop = true;
        const panner = mixer.context.createPanner();
        panner.panningModel = "HRTF"; panner.distanceModel = "inverse";
        panner.refDistance = 0.25; panner.maxDistance = 5; panner.rolloffFactor = 1.2;
        source.connect(panner).connect(mixer.effects);
        sounds.current[index] = { source, panner };
        source.start();
      });
      setEnabled(true);
    } catch { if (request === generation.current) { stop(); setError("Les ambiances sonores sont indisponibles. Réessayez."); } }
    finally { if (request === generation.current) { starting.current = false; setBusy(false); } }
  }, [active, enabled, repeat, stop]);
  // A new stop cancels the previous sentence rather than queuing narration.
  const lastText = useRef(text);
  useEffect(() => {
    if (lastText.current !== text && enabled && active) repeat();
    lastText.current = text;
  }, [text, enabled, active, repeat]);
  useEffect(() => { if (!active) stop(); }, [active, stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); stop(); };
  }, [stop]);
  useFrame(() => {
    if (!enabled || !model.current || !sounds.current.length) return;
    const { context } = getVillageMixer();
    camera.getWorldPosition(position.current);
    camera.getWorldQuaternion(rotation.current);
    forward.current.set(0, 0, -1).applyQuaternion(rotation.current);
    up.current.set(0, 1, 0).applyQuaternion(rotation.current);
    const listener = context.listener;
    listener.positionX.value = position.current.x; listener.positionY.value = position.current.y; listener.positionZ.value = position.current.z;
    listener.forwardX.value = forward.current.x; listener.forwardY.value = forward.current.y; listener.forwardZ.value = forward.current.z;
    listener.upX.value = up.current.x; listener.upY.value = up.current.y; listener.upZ.value = up.current.z;
    model.current.updateWorldMatrix(true, false);
    sounds.current.forEach((sound, index) => {
      const place = AR_SOUND_POSITIONS[index];
      if (!place) return;
      position.current.set(...place.pos).applyMatrix4(model.current?.matrixWorld ?? new THREE.Matrix4());
      sound.panner.positionX.value = position.current.x; sound.panner.positionY.value = position.current.y; sound.panner.positionZ.value = position.current.z;
    });
  });
  return { enabled, speaking, busy, error, start, stop, repeat };
}