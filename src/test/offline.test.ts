import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/village-places";
import { planTourOffline } from "@/lib/offline-tour";
import { writeLetterOffline } from "@/lib/offline-letter";

const ids = new Set(PLACES.map((place) => place.id));

describe("parcours hors ligne", () => {
  it("choisit le thème qui correspond au souhait, accents et majuscules compris", () => {
    const sweet = planTourOffline("Des DOUCEURS sucrées et du chocolat chaud");
    expect("stops" in sweet && sweet.stops.map((s) => s.id)).toEqual(
      expect.arrayContaining(["chocolaterie", "boulangerie"]),
    );
    const tales = planTourOffline("des histoires au coin du feu");
    expect("stops" in tales && tales.stops[0]?.id).toBe("chalet-contes");
  });
  it("donne toujours 3 à 6 étapes du catalogue, avec une note courte", () => {
    for (const wish of [
      "chocolat",
      "jeux pour les enfants",
      "rennes",
      "artisanat",
      "xyz inconnu",
    ]) {
      const tour = planTourOffline(wish);
      if (!("stops" in tour)) throw new Error("expected a tour");
      expect(tour.title.length).toBeGreaterThan(0);
      expect(tour.stops.length).toBeGreaterThanOrEqual(3);
      expect(tour.stops.length).toBeLessThanOrEqual(6);
      for (const stop of tour.stops) {
        expect(ids.has(stop.id)).toBe(true);
        expect(stop.note.split(/\s+/).length).toBeLessThanOrEqual(25);
      }
    }
  });
  it("sans thème reconnu, propose le grand tour du village", () => {
    const tour = planTourOffline("je ne sais pas");
    expect("title" in tour && tour.title).toMatch(/grand tour/i);
  });
  it("refuse un souhait vide comme la version en ligne", () => {
    expect(planTourOffline("   ")).toEqual({ error: "Décrivez ce que vous souhaitez découvrir." });
  });
});

describe("lettre hors ligne", () => {
  it("répond par le prénom, reprend un souhait et signe Le Père Noël", () => {
    const result = writeLetterOffline({
      name: "Awa",
      letter: "Bonjour ! Cette année je voudrais un vélo rouge. Merci.",
    });
    if (!("reply" in result)) throw new Error("expected a reply");
    expect(result.reply).toMatch(/^Ch(er|ère) Awa/);
    expect(result.reply).toContain("un vélo rouge");
    expect(result.reply.trim().endsWith("Le Père Noël")).toBe(true);
    const words = result.reply.split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(80);
    expect(words).toBeLessThanOrEqual(170);
  });
  it("ne promet jamais de livrer un cadeau", () => {
    const result = writeLetterOffline({ name: "", letter: "Je souhaite une console." });
    expect("reply" in result && result.reply).not.toMatch(
      /je t'apporterai|tu recevras|je livrerai/i,
    );
    expect("reply" in result && result.reply).toMatch(/^Cher visiteur/);
  });
  it("valide la lettre comme le serveur (vide ou trop longue)", () => {
    expect(writeLetterOffline({ name: "", letter: "  " })).toEqual({
      error: "Écrivez votre lettre.",
    });
    expect("error" in writeLetterOffline({ name: "", letter: "a".repeat(1501) })).toBe(true);
  });
});
