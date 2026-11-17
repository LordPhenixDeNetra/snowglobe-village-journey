import { describe, expect, it } from "vitest";
import { arPanelRows, panelLayout, vrPanelRows, wrapLabel, type PanelState } from "@/lib/xr-panel";

const base: PanelState = { focusName: "La Chocolaterie", note: "Miam.", step: 0, count: 3, more: false, smooth: false, audio: { enabled: false, busy: false, speaking: false, error: null }, ambienceLabel: "Nuit polaire", snow: 30, found: 2, activity: null };

describe("panneau VR", () => {
  it("trois niveaux : parcours, conteur, Plus…", () => {
    const rows = vrPanelRows(base);
    expect(rows.map(r => r.map(b => b.id))).toEqual([["prev", "stop", "next"], ["narrator", "repeat", "viewpoint"], ["more"]]);
    expect(rows[0]![0]!.disabled).toBe(true); expect(rows[0]![2]!.disabled).toBe(false);
    expect(rows[0]![1]!.label).toBe("1/3 · La Chocolaterie");
    expect(rows[1]![1]!.disabled).toBe(true);
  });
  it("Plus… dévoile réglages, activités et sortie", () => {
    const rows = vrPanelRows({ ...base, more: true, activity: "hunt" });
    expect(rows.flat().map(b => b.id)).toEqual(expect.arrayContaining(["rotation", "ambience", "snow", "letter", "hunt", "tree", "exit"]));
    expect(rows.flat().find(b => b.id === "hunt")).toMatchObject({ label: "Cadeaux · 2/5", pressed: true });
    expect(rows.flat().find(b => b.id === "more")!.label).toBe("Moins");
  });
  it("hors parcours : promenade libre, navigation désactivée", () => {
    const rows = vrPanelRows({ ...base, focusName: null, count: 0 });
    expect(rows[0]!.map(b => b.disabled)).toEqual([true, false, true]); expect(rows[0]![1]!.label).toBe("Promenade libre");
  });
  it("erreur audio : une ligne large en dernier", () => {
    const rows = vrPanelRows({ ...base, audio: { ...base.audio, error: "Voix indisponible" } });
    expect(rows.at(-1)).toEqual([{ id: "audio-error", label: "Voix indisponible", wide: true }]);
  });
  it("disposition centrée sans chevauchement", () => {
    const layout = panelLayout(vrPanelRows(base));
    const stop = layout.find(b => b.id === "stop")!; expect(stop.position[0]).toBeCloseTo(0); expect(stop.width).toBeCloseTo(1.32);
    const prev = layout.find(b => b.id === "prev")!, next = layout.find(b => b.id === "next")!;
    expect(prev.position[0]).toBeCloseTo(-next.position[0]); expect(next.position[0] - stop.position[0]).toBeGreaterThanOrEqual((1.32 + 0.64) / 2 + 0.04 - 1e-9);
    expect(layout.find(b => b.id === "prev")!.position[1]).toBeGreaterThan(layout.find(b => b.id === "narrator")!.position[1]);
    expect(layout.width).toBeCloseTo(2.68); expect(layout.height).toBeCloseTo(0.21 * 3 + 0.04 * 2);
  });
  it("coupe les libellés longs sur deux lignes avec ellipse", () => {
    expect(wrapLabel("1/3 · La Boutique de Décorations", 18, 2)).toEqual(["1/3 · La Boutique", "de Décorations"]);
    expect(wrapLabel("a ".repeat(40), 10, 2)[1]!.endsWith("…")).toBe(true);
    expect(wrapLabel("Suivant", 18, 2)).toEqual(["Suivant"]);
  });
});

describe("repli AR sans overlay", () => {
  it("avant la pose : Poser (désactivé sans surface) et Quitter", () => {
    const rows = arPanelRows({ ...base, placed: false, surface: false });
    expect(rows.flat().map(b => [b.id, b.disabled])).toEqual([["place", true], ["exit", undefined]]);
    expect(arPanelRows({ ...base, placed: false, surface: true })[0]![0]).toMatchObject({ label: "Poser le village", disabled: false });
  });
  it("après la pose : replié par défaut pour laisser voir la maquette, Quitter toujours accessible", () => {
    const rows = arPanelRows({ ...base, placed: true, surface: true, more: false });
    expect(rows.map(r => r.map(b => b.id))).toEqual([["prev", "stop", "next"], ["narrator", "repeat"], ["more", "exit"]]);
    expect(arPanelRows({ ...base, focusName: null, count: 0, placed: true, surface: true, more: false })[0]!.map(b => b.id)).toEqual(["narrator", "repeat"]);
  });
  it("après la pose, Plus… : maquette, ambiance, activités, repositionner", () => {
    const rows = arPanelRows({ ...base, placed: true, surface: true, more: true });
    expect(rows.map(r => r.map(b => b.id))).toEqual([["prev", "stop", "next"], ["narrator", "repeat"], ["more", "exit"], ["smaller", "bigger", "rotate"], ["ambience", "snow"], ["letter", "hunt", "tree"], ["reposition"]]);
    expect(rows.flat().find(b => b.id === "more")!.label).toBe("Moins");
  });
});
