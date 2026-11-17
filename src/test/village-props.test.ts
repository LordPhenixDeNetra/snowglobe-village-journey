import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/village-places";
import { GIFTS } from "@/lib/village-activities";
import { sleighDestination } from "@/lib/sleigh-motion";
import { viewpoint } from "@/lib/xr-navigation";
import { CHALETS, LAMP_POSTS, OBSTACLES, LAKE, PADDOCK, TREE_TIERS, treeRadiusAt, insideLake, forestPlacements, forestMatrices, garlandSpans, lampPoolOpacity, pathLayout, seeded, REINDEER, PADDOCK_FENCE, ELVES, SANTA, SKATERS, routeLength, sampleRoute, type Route } from "@/lib/village-props";
import { GIFTS as HUNT, ornamentPosition } from "@/lib/village-activities";
import { SLEIGH_HOME, sleighPosition, type SleighPosition } from "@/lib/sleigh-motion";
import * as THREE from "three";

const d = (a: readonly number[], b: readonly number[]) => Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0));

describe("village props", () => {
  it("un chalet par lieu de l'anneau, couleur tirée de la description", () => {
    expect(CHALETS.map(c => c.id)).toEqual(PLACES.filter(p => p.id !== "grand-sapin" && !p.id.startsWith("bonhomme")).map(p => p.id));
    expect(CHALETS.find(c => c.id === "poste-pere-noel")?.facade).toBe("blue");
    expect(new Set(CHALETS.map(c => c.variant)).size).toBe(3);
  });
  it("les lampadaires sont entre les chalets, hors des points de vue et de la place du traîneau", () => {
    expect(LAMP_POSTS).toHaveLength(8);
    for (const post of LAMP_POSTS) {
      expect(Math.hypot(...post)).toBeCloseTo(6.5, 5);
      for (const place of PLACES) {
        expect(d(post, [place.pos[0], place.pos[2]])).toBeGreaterThan(place.id.startsWith("bonhomme") ? 1 : 1.8);
        const [vx, , vz] = viewpoint(place);
        expect(d(post, [vx, vz])).toBeGreaterThan(0.6);
        const sleigh = sleighDestination(place.id)!;
        expect(d(post, [sleigh[0], sleigh[2]])).toBeGreaterThan(1.5);
      }
      for (const gift of GIFTS) expect(d(post, [gift.pos[0], gift.pos[2]])).toBeGreaterThan(1);
    }
    expect(OBSTACLES.every(o => o.r === 0.35)).toBe(true);
  });
  it("le lac ne contient ni point de vue, ni cadeau, ni emprise de chalet, ni le pied du sapin", () => {
    for (const place of PLACES) {
      const [vx, , vz] = viewpoint(place);
      expect(insideLake(vx, vz)).toBe(false);
      expect(d(LAKE.center, [place.pos[0], place.pos[2]])).toBeGreaterThan(place.id === "grand-sapin" ? 2.8 + 1.5 : place.id.startsWith("bonhomme") ? 1 + 2.2 : 1.45 + 2.2);
    }
    for (const gift of GIFTS) expect(insideLake(gift.pos[0], gift.pos[2])).toBe(false);
    expect(insideLake(LAKE.center[0], LAKE.center[1])).toBe(true);
  });
  it("la silhouette du sapin porte les boules de ornamentPosition", () => {
    expect(TREE_TIERS).toHaveLength(5);
    expect(treeRadiusAt(1.4)).toBeCloseTo(2.34, 0);
    expect(treeRadiusAt(4.19)).toBeCloseTo(0.86, 0);
    expect(treeRadiusAt(6.4)).toBeLessThan(0.3);
  });
  it("la forêt est déterministe, dans la couronne 13–21 m, hors de l'enclos et loin des cadeaux", () => {
    const trees = forestPlacements();
    expect(trees).toHaveLength(82);
    expect(trees[0]).toMatchObject({ x: -11.3, z: -3, scale: 1.4 });
    expect(forestPlacements()).toEqual(trees);
    for (const t of trees.slice(2)) {
      const r = Math.hypot(t.x, t.z);
      expect(r).toBeGreaterThanOrEqual(13);
      expect(r).toBeLessThanOrEqual(21);
      expect(d([t.x, t.z], PADDOCK.center)).toBeGreaterThan(PADDOCK.r);
      for (const gift of GIFTS) expect(d([t.x, t.z], [gift.pos[0], gift.pos[2]])).toBeGreaterThan(0.9);
    }
  });
  it("les boules et les guirlandes du sapin restent sur le feuillage, ni flottantes ni enfouies", () => {
    const check = (y: number, r: number) => {
      expect(r - treeRadiusAt(y)).toBeLessThanOrEqual(0.13);
      expect(treeRadiusAt(y) - r).toBeLessThanOrEqual(0.1);
    };
    for (let i = 0; i < 10; i++) { const [x, y, z] = ornamentPosition(i); check(y, Math.hypot(x, z)); }
    // Same curve as TreeDecorations: three turns from y = 1.2, r = 2.35 − 0.51 (y − 1.2).
    for (let n = 0; n < 3; n++) for (let i = 0; i <= 20; i++) { const y = 1.2 + n * 1.15 + (i / 20) * 0.7; check(y, 2.35 - (y - 1.2) * 0.51); }
  });
  it("le traîneau survole les têtes de lampadaire sur tous ses trajets", () => {
    const stops: SleighPosition[] = [SLEIGH_HOME, ...PLACES.map(p => sleighDestination(p.id)!)];
    for (const from of stops) for (const to of stops) {
      if (from === to) continue;
      for (let i = 0; i <= 100; i++) {
        const [x, y, z] = sleighPosition(from, to, i / 100);
        for (const post of LAMP_POSTS) if (d([x, z], post) < 1) expect(y, `${from} → ${to} at ${i}%`).toBeGreaterThanOrEqual(3.1);
      }
    }
  });
  it("les chemins tassés contournent le lac", () => {
    const { spokes, arcs } = pathLayout();
    expect(spokes.length).toBeGreaterThanOrEqual(6);
    for (const a of spokes) for (let r = 3; r <= 7.6; r += 0.1) expect(insideLake(Math.cos(a) * r, Math.sin(a) * r, 0.35)).toBe(false);
    for (const [start, length] of arcs) for (let t = 0; t <= 1; t += 0.02) for (const r of [5.6, 6, 6.4]) {
      const a = start + t * length;
      expect(insideLake(Math.cos(a) * r, Math.sin(a) * r, 0.35)).toBe(false);
    }
    expect(arcs.reduce((sum, [, length]) => sum + length, 0)).toBeGreaterThan(Math.PI * 1.6);
  });
  it("la forêt est décrite une fois en matrices d'instances (troncs, étages, calottes)", () => {
    const { trunks, tiers, caps } = forestMatrices();
    expect(trunks).toHaveLength(82); expect(tiers).toHaveLength(246); expect(caps).toHaveLength(82);
    const position = new THREE.Vector3().setFromMatrixPosition(trunks[0]!);
    expect(position.toArray()).toEqual([-11.3, expect.closeTo(0.84, 5), -3]);
    for (const gift of HUNT.filter(g => g.id === "foret" || g.id === "clairiere")) {
      const lowest = tiers.map(m => new THREE.Vector3().setFromMatrixPosition(m)).filter(p => d([p.x, p.z], [gift.pos[0], gift.pos[2]]) < 0.01);
      // Skirt bottom = centre − half the 1.1 m cone × scale 1.4: above the 0.8 m gift.
      expect(Math.min(...lowest.map(p => p.y)) - 0.55 * 1.4).toBeGreaterThan(0.8);
    }
  });
  it("huit guirlandes entre chalets voisins, opacité des halos par ambiance, graine stable", () => {
    expect(garlandSpans()).toHaveLength(8);
    expect(garlandSpans()[0]!.from).not.toEqual(garlandSpans()[0]!.to);
    expect(lampPoolOpacity("day")).toBe(0);
    expect(lampPoolOpacity("night")).toBe(0.9);
    expect(seeded(7)()).toBe(seeded(7)());
  });
  it("les rennes restent dans l'enclos, loin de la clôture", () => {
    for (const r of REINDEER) for (const p of r.route ? sampleRoute(r.route) : [r.at]) expect(d(p, PADDOCK.center)).toBeLessThanOrEqual(PADDOCK.r - 0.6);
    expect(PADDOCK_FENCE.length).toBe(12);
    expect(Math.hypot(...PADDOCK.center) + PADDOCK.r).toBeLessThan(21); // AR : rayon 23
  });
  it("lutins et Père Noël ne traversent ni chalet, ni lampadaire, ni sapin, et laissent libres points de vue, parking du traîneau et cadeaux", () => {
    const spots = [...ELVES.flatMap(e => e.route ? sampleRoute(e.route) : [e.at]), SANTA.at];
    for (const p of spots) {
      expect(Math.hypot(...p)).toBeGreaterThan(3.3);                       // sapin (rayon 2,6 au pied)
      for (const c of CHALETS) { const place = PLACES.find(x => x.id === c.id)!; expect(d(p, [place.pos[0], place.pos[2]])).toBeGreaterThan(1.9); }
      for (const post of LAMP_POSTS) expect(d(p, post)).toBeGreaterThan(0.7);
      for (const place of PLACES) { const [vx, , vz] = viewpoint(place); expect(d(p, [vx, vz])).toBeGreaterThan(0.8); const s = sleighDestination(place.id)!; expect(d(p, [s[0], s[2]])).toBeGreaterThan(1.6); }
      for (const g of GIFTS) expect(d(p, [g.pos[0], g.pos[2]])).toBeGreaterThan(1);
      expect(insideLake(p[0], p[1], 0.3)).toBe(false);
      expect(d(p, [SLEIGH_HOME[0], SLEIGH_HOME[2]])).toBeGreaterThan(1.8);    // traîneau garé hors visite
      for (const place of PLACES.filter(x => x.id.startsWith("bonhomme"))) expect(d(p, [place.pos[0], place.pos[2]])).toBeGreaterThan(1.1);
    }
  });
  it("les patineurs restent sur la glace", () => {
    expect(SKATERS).toHaveLength(2);
    for (const s of SKATERS) for (const p of sampleRoute(s.route)) expect(insideLake(p[0], p[1], -0.3)).toBe(true);
  });
  it("routeLength et sampleRoute sont cohérents", () => {
    const square: Route = { points: [[0, 0], [1, 0], [1, 1], [0, 1]], loop: true };
    expect(routeLength(square)).toBeCloseTo(4); expect(routeLength({ ...square, loop: false })).toBeCloseTo(3);
    expect(sampleRoute(square, 0.5)).toHaveLength(8);
  });
});
