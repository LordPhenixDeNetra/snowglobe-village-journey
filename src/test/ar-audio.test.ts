import { describe, expect, it } from "vitest";
import { AR_SOUND_POSITIONS, narrationForStop } from "@/lib/ar-audio";
import { PLACES } from "@/lib/village-places";

describe("AR storyteller", () => {
  it("narrates the active personalized stop without inventing destinations", () => {
    const place = PLACES.find((item) => item.id === "chocolaterie");
    expect(narrationForStop(place ?? null, "Votre chocolat chaud vous attend.", 1, 3)).toBe(
      "Étape 2 sur 3. La Chocolaterie. Votre chocolat chaud vous attend.",
    );
    expect(narrationForStop(null, "note", 0, 0)).toBe("");
  });
  it("uses the place description when a personalized note is absent", () => {
    const place = PLACES[0];
    expect(narrationForStop(place ?? null, undefined, 0, 2)).toBe(
      `Étape 1 sur 2. Le Grand Sapin. ${place?.desc}`,
    );
  });
  it("locates bells at the tree and wood fire at the storytelling chalet", () => {
    expect(AR_SOUND_POSITIONS.map((item) => item.id)).toEqual(["grand-sapin", "chalet-contes"]);
    expect(AR_SOUND_POSITIONS[0]?.pos).toEqual([0, 3, 0]);
    expect(AR_SOUND_POSITIONS[1]?.pos).toEqual(
      PLACES.find((item) => item.id === "chalet-contes")?.pos,
    );
  });
});
