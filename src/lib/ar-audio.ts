import { PLACES, type Place } from "./village-places";

export const AR_SOUND_PLACES = ["grand-sapin", "chalet-contes"] as const;
export const AR_SOUND_POSITIONS = AR_SOUND_PLACES.map((id) => {
  const place = PLACES.find((item) => item.id === id);
  return { id, pos: place?.pos ?? [0, 0, 0] };
});
export function narrationForStop(
  place: Place | null,
  note: string | undefined,
  step: number,
  count: number,
): string {
  if (!place || count < 1) return "";
  return `Étape ${step + 1} sur ${count}. ${place.name}. ${note?.trim() || place.desc}`;
}
