import { z } from "zod";

export const GIFTS = [
  { id: "chocolat", pos: [10.7, 0, -1.4] as [number, number, number], hint: "Derrière la Chocolaterie, côté forêt." },
  { id: "jouets", pos: [7.8, 0, 7.8] as [number, number, number], hint: "Derrière l’Atelier des Jouets." },
  { id: "courrier", pos: [-7.8, 0, 7.8] as [number, number, number], hint: "Derrière la Poste du Père Noël." },
  { id: "foret", pos: [-11.3, 0, -3] as [number, number, number], hint: "Sous le petit sapin à l’ouest." },
  { id: "clairiere", pos: [2.5, 0, -11.3] as [number, number, number], hint: "Sous le petit sapin au nord." },
] as const;

export function collectGift(found: readonly string[], id: string): string[] {
  if (!GIFTS.some(gift => gift.id === id) || found.includes(id)) return [...found];
  return [...found, id];
}
export function huntComplete(found: readonly string[]) {
  return GIFTS.every(gift => found.includes(gift.id));
}
export const ORNAMENT_COLORS = ["red", "gold", "blue", "green"] as const;
export type OrnamentColor = typeof ORNAMENT_COLORS[number];
export type StarEffect = "steady" | "pulse" | "twinkle";
export type Decoration = { ornaments: OrnamentColor[]; garlands: number; star: StarEffect };
export const INITIAL_DECORATION: Decoration = { ornaments: [], garlands: 0, star: "pulse" };
export function ornamentPosition(index: number): [number, number, number] {
  const y = 1.4 + (index % 10) * 0.31;
  const radius = 2.34 - (index % 10) * 0.164;
  const angle = index * 2.39996;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}
export function addOrnament(decoration: Decoration, color: OrnamentColor): Decoration {
  return decoration.ornaments.length >= 60 ? decoration : { ...decoration, ornaments: [...decoration.ornaments, color] };
}
export function addGarland(decoration: Decoration): Decoration {
  return { ...decoration, garlands: Math.min(3, decoration.garlands + 1) };
}
export function nextStar(effect: StarEffect): StarEffect {
  return effect === "steady" ? "pulse" : effect === "pulse" ? "twinkle" : "steady";
}
export const letterSchema = z.object({
  name: z.string().trim().max(60).default(""),
  letter: z.string().trim().min(1, "Écrivez votre lettre.").max(1500),
});