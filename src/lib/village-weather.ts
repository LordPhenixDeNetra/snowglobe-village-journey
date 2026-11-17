export type Ambience = "day" | "dusk" | "night";
export const AMBIENCES: Ambience[] = ["day", "dusk", "night"];
export const AMBIENCE_LABELS = { day: "Jour", dusk: "Crépuscule", night: "Nuit polaire" };
export function nextAmbience(value: Ambience): Ambience {
  return AMBIENCES[(AMBIENCES.indexOf(value) + 1) % 3] ?? "day";
}
export function snowfall(value: number) {
  const intensity = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 30;
  return {
    intensity,
    count: Math.round(300 + intensity * 27),
    speed: 0.45 + intensity * 0.018,
    wind: intensity * 0.025,
  };
}
export const WEATHER_LIGHT = {
  day: { ambient: 0.8, sun: 1.8, position: [10, 18, 5] as [number, number, number] },
  dusk: { ambient: 0.5, sun: 1.3, position: [-15, 4, -8] as [number, number, number] },
  night: { ambient: 0.35, sun: 0.55, position: [10, 15, 5] as [number, number, number] },
};
