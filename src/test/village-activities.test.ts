import { describe, expect, it } from "vitest";
import { GIFTS, collectGift, huntComplete, INITIAL_DECORATION, addGarland, addOrnament, nextStar, letterSchema } from "@/lib/village-activities";

describe("Christmas activities", () => {
  it("requires exactly five distinct hidden gifts for the celebration", () => {
    expect(GIFTS).toHaveLength(5);
    let found: string[] = [];
    for (const gift of GIFTS.slice(0, 4)) found = collectGift(found, gift.id);
    expect(huntComplete(found)).toBe(false);
    expect(collectGift(found, "inconnu")).toEqual(found);
    expect(collectGift(found, GIFTS[0].id)).toHaveLength(4);
    found = collectGift(found, GIFTS[4].id);
    expect(found).toHaveLength(5); expect(huntComplete(found)).toBe(true);
  });
  it("adds colored ornaments and garlands without changing the selected star effect", () => {
    const tree = addGarland(addOrnament(INITIAL_DECORATION, "blue"));
    expect(tree).toEqual({ ornaments: ["blue"], garlands: 1, star: "pulse" });
    expect(INITIAL_DECORATION.ornaments).toEqual([]);
  });
  it("offers steady, breathing and sparkling star effects", () => {
    expect(nextStar("steady")).toBe("pulse"); expect(nextStar("pulse")).toBe("twinkle"); expect(nextStar("twinkle")).toBe("steady");
  });
  it("bounds decorations for immersive devices", () => {
    expect(addGarland({ ...INITIAL_DECORATION, garlands: 3 }).garlands).toBe(3);
    expect(addOrnament({ ...INITIAL_DECORATION, ornaments: Array(60).fill("red") }, "blue").ornaments).toHaveLength(60);
  });
  it("accepts wishes but rejects empty or oversized letters", () => {
    expect(letterSchema.parse({ name: " Moussa ", letter: " La paix et un vélo " })).toEqual({ name: "Moussa", letter: "La paix et un vélo" });
    expect(letterSchema.safeParse({ letter: " " }).success).toBe(false);
    expect(letterSchema.safeParse({ letter: "a".repeat(1501) }).success).toBe(false);
  });
});