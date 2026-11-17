// One gesture-started context shared by music and the AR soundscape.
export type VillageMixer = {
  context: AudioContext;
  music: GainNode;
  effects: GainNode;
  analyser: AnalyserNode;
  musicVolume: number;
};
let mixer: VillageMixer | undefined;
export function getVillageMixer(): VillageMixer {
  if (mixer && mixer.context.state !== "closed") return mixer;
  const context = new AudioContext();
  const music = context.createGain(),
    effects = context.createGain();
  const master = context.createGain(),
    limiter = context.createDynamicsCompressor(),
    analyser = context.createAnalyser();
  master.gain.value = 0.7;
  analyser.fftSize = 1024;
  music.connect(master);
  effects.connect(master);
  master.connect(limiter).connect(analyser).connect(context.destination);
  music.gain.value = 0.35;
  effects.gain.value = 0.65;
  mixer = { context, music, effects, analyser, musicVolume: 0.35 };
  return mixer;
}
export function setMusicVolume(value: number) {
  if (!mixer) return;
  mixer.musicVolume = value;
  mixer.music.gain.setTargetAtTime(value, mixer.context.currentTime, 0.1);
}
export function duckMusic(speaking: boolean) {
  if (!mixer) return;
  mixer.music.gain.setTargetAtTime(
    mixer.musicVolume * (speaking ? 0.25 : 1),
    mixer.context.currentTime,
    0.15,
  );
  mixer.effects.gain.setTargetAtTime(speaking ? 0.25 : 0.65, mixer.context.currentTime, 0.15);
}
