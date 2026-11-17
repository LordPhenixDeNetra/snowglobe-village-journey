import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/village-places";
import { GIFTS } from "@/lib/village-activities";
import { sleighDestination } from "@/lib/sleigh-motion";
import { viewpoint } from "@/lib/xr-navigation";
import { CHALETS, LAMP_POSTS, OBSTACLES, LAKE, PADDOCK, TREE_TIERS, treeRadiusAt, insideLake, forestPlacements, forestMatrices, garlandSpans, garlandPoint, lampPoolOpacity, pathLayout, seeded, REINDEER, PADDOCK_FENCE, ELVES, SANTA, SKATERS, routeLength, sampleRoute, type Route, type XZ } from "@/lib/village-props";
import { GIFTS as HUNT, ornamentPosition } from "@/lib/village-activities";
import { SLEIGH_HOME, sleighPosition, type SleighPosition } from "@/lib/sleigh-motion";
import { followRoute, startWalker } from "@/lib/gait";
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
    // Ruling: the two gift trees moved 0.65 m outward (trunk no longer through the gift), no longer on the gift centre.
    for (const [i, id] of [[0, "foret"], [1, "clairiere"]] as const) {
      const gift = GIFTS.find(g => g.id === id)!;
      expect(trees[i]).toMatchObject({ x: expect.closeTo(gift.pos[0] * (1 + 0.65 / Math.hypot(gift.pos[0], gift.pos[2])), 5), z: expect.closeTo(gift.pos[2] * (1 + 0.65 / Math.hypot(gift.pos[0], gift.pos[2])), 5), scale: 1.4 });
    }
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
    // Ruling: the gift tree sits 0.65 m outward of its gift, so the matrices follow forestPlacements()[0], not the gift.
    const first = forestPlacements()[0]!;
    expect(position.toArray()).toEqual([expect.closeTo(first.x, 5), expect.closeTo(0.84, 5), expect.closeTo(first.z, 5)]);
    for (const [i, gift] of HUNT.filter(g => g.id === "foret" || g.id === "clairiere").entries()) {
      const tree = forestPlacements()[i]!;
      const lowest = tiers.map(m => new THREE.Vector3().setFromMatrixPosition(m)).filter(p => d([p.x, p.z], [tree.x, tree.z]) < 0.01);
      expect(lowest).toHaveLength(3);
      // Skirt bottom = centre − half the 1.1 m cone × scale 1.4: above the 0.8 m gift.
      expect(Math.min(...lowest.map(p => p.y)) - 0.55 * 1.4).toBeGreaterThan(0.8);
    }
  });
  it("les petits sapins des cadeaux : tronc à l'écart du cadeau, cadeau sous la jupe", () => {
    const trees = forestPlacements();
    for (const [i, id] of [[0, "foret"], [1, "clairiere"]] as const) {
      const gift = GIFTS.find(g => g.id === id)!, tree = trees[i]!;
      const gap = d([tree.x, tree.z], [gift.pos[0], gift.pos[2]]);
      expect(gap).toBeGreaterThanOrEqual(0.45);
      expect(gap).toBeGreaterThanOrEqual(0.17 * tree.scale + 0.35);           // trunk foot radius + half the gift lid
      expect(gap + 0.35 * Math.SQRT2).toBeLessThanOrEqual(0.95 * tree.scale); // gift corner still under the lowest skirt
    }
  });
  it("les guirlandes passent au-dessus d'un visiteur VR (≥ 2,6 m)", () => {
    for (const { from, to } of garlandSpans()) for (let i = 0; i <= 100; i++) {
      const [x, y, z] = garlandPoint(from, to, i / 100);
      expect(y).toBeGreaterThanOrEqual(2.6);
      if (i === 0) expect([x, z]).toEqual(from);
    }
  });
  it("huit guirlandes entre chalets voisins, opacité des halos par ambiance, graine stable", () => {
    expect(garlandSpans()).toHaveLength(8);
    expect(garlandSpans()[0]!.from).not.toEqual(garlandSpans()[0]!.to);
    expect(lampPoolOpacity("day")).toBe(0);
    expect(lampPoolOpacity("night")).toBe(0.9);
    expect(seeded(7)()).toBe(seeded(7)());
  });
  it("les rennes restent dans l'enclos, loin de la clôture, tête comprise", () => {
    for (const r of REINDEER) for (const p of r.route ? sampleRoute(r.route) : [r.at]) expect(d(p, PADDOCK.center)).toBeLessThanOrEqual(PADDOCK.r - 0.6);
    // Footprint: the head reaches 1.3 m ahead of the body centre; it never passes the fence line (the trotting head is also above the 1.1 m rails).
    const HEAD = 1.3;
    for (const r of REINDEER) {
      if (!r.route) { expect(d([r.at[0] + HEAD * Math.sin(r.yaw), r.at[1] + HEAD * Math.cos(r.yaw)], PADDOCK.center)).toBeLessThanOrEqual(PADDOCK.r); continue; }
      const w = startWalker(r.route);
      for (let i = 0; i < 400; i++) {
        followRoute(w, r.route, 1.1, 0.05, 3);
        expect(d([w.position[0] + HEAD * Math.sin(w.yaw), w.position[1] + HEAD * Math.cos(w.yaw)], PADDOCK.center)).toBeLessThanOrEqual(PADDOCK.r);
      }
    }
    expect(PADDOCK_FENCE.length).toBe(12);
    expect(Math.hypot(...PADDOCK.center) + PADDOCK.r).toBeLessThan(21); // AR : rayon 23
  });
  it("lutins et Père Noël, emprise comprise, ne traversent ni chalet, ni lampadaire, ni sapin, et laissent libres points de vue, parking du traîneau et cadeaux", () => {
    // Footprint radii: walking elf 0.4 m (gift held in front), other elves 0.4 m (workbench), Santa 0.5 m.
    const spots: [XZ, number][] = [...ELVES.flatMap(e => (e.route ? sampleRoute(e.route) : [e.at]).map(p => [p, 0.4] as [XZ, number])), [SANTA.at, 0.5]];
    for (const [p, r] of spots) {
      expect(Math.hypot(...p) - r).toBeGreaterThan(2.8);                    // sapin (rayon 2,6 au pied, cadeaux du socle)
      for (const c of CHALETS) { const place = PLACES.find(x => x.id === c.id)!; expect(d(p, [place.pos[0], place.pos[2]]) - r).toBeGreaterThan(1.45); }
      for (const post of LAMP_POSTS) expect(d(p, post) - r).toBeGreaterThan(0.25);
      for (const place of PLACES) { const [vx, , vz] = viewpoint(place); expect(d(p, [vx, vz]) - r).toBeGreaterThan(0.35); const s = sleighDestination(place.id)!; expect(d(p, [s[0], s[2]]) - r).toBeGreaterThan(1.1); }
      for (const g of GIFTS) expect(d(p, [g.pos[0], g.pos[2]]) - r).toBeGreaterThan(0.5);
      expect(insideLake(p[0], p[1], 0.3 + r)).toBe(false);
      expect(d(p, [SLEIGH_HOME[0], SLEIGH_HOME[2]]) - r).toBeGreaterThan(1.3);    // traîneau garé hors visite
      for (const place of PLACES.filter(x => x.id.startsWith("bonhomme"))) expect(d(p, [place.pos[0], place.pos[2]]) - r).toBeGreaterThan(0.6);
    }
  });
  it("les patineurs restent sur la glace", () => {
    expect(SKATERS).toHaveLength(2);
    for (const s of SKATERS) for (const p of sampleRoute(s.route)) expect(insideLake(p[0], p[1], -0.3)).toBe(true);
  });
  it("les patineurs, sur leurs trajets réels, gardent leurs mains à 0,5 m l'une de l'autre", () => {
    // Same start as Villagers: the second skater begins `phase` of a loop ahead, both at 1.4 m/s.
    const walkers = SKATERS.map(s => { const w = startWalker(s.route); followRoute(w, s.route, s.phase * routeLength(s.route) / 0.05, 0.05, Infinity); return w; });
    let closest = Infinity;
    for (let i = 0; i < 2000; i++) {
      SKATERS.forEach((s, k) => followRoute(walkers[k]!, s.route, 1.4, 0.01, 3));
      closest = Math.min(closest, d(walkers[0]!.position, walkers[1]!.position));
    }
    // Ruling: 1.6 m cannot fit on a figure eight inside this ice (best ≈ 1.53 m); 2 × 0.5 m reach + 0.5 m gap = 1.5 m.
    expect(closest).toBeGreaterThanOrEqual(2 * 0.5 + 0.5);
  });
  it("routeLength et sampleRoute sont cohérents", () => {
    const square: Route = { points: [[0, 0], [1, 0], [1, 1], [0, 1]], loop: true };
    expect(routeLength(square)).toBeCloseTo(4); expect(routeLength({ ...square, loop: false })).toBeCloseTo(3);
    expect(sampleRoute(square, 0.5)).toHaveLength(8);
  });
});
