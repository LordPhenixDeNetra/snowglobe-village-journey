import { describe, expect, it } from "vitest";
import { bipedLimbs, bipedStep, followRoute, quadrupedLegs, skateLean, startWalker, stridePhase } from "@/lib/gait";
import type { Route } from "@/lib/village-props";

describe("pas du bipède", () => {
  // Elf proportions in model units (rig scaled ×1.1 in the scene): thigh 0.21, shin 0.235, stride 0.5.
  const THIGH = 0.21, SHIN = 0.235, STRIDE = 0.5;
  const foot = (hipZ: number, drop: number, thigh: number, knee: number) => ({
    z: hipZ - (THIGH * Math.sin(thigh) + SHIN * Math.sin(thigh + knee)),
    y: (THIGH + SHIN - drop) - (THIGH * Math.cos(thigh) + SHIN * Math.cos(thigh + knee)),
  });
  it("le pied d'appui reste fixe au sol pendant que le corps avance (pas de glissement)", () => {
    for (const side of ["L", "R"] as const) {
      let planted: number | null = null, drift = 0;
      for (let i = 0; i <= 400; i++) {
        const phase = i / 400, step = bipedStep(phase, STRIDE, THIGH, SHIN);
        const f = side === "L" ? foot(phase * STRIDE, step.drop, step.thighL, step.kneeL) : foot(phase * STRIDE, step.drop, step.thighR, step.kneeR);
        expect(f.y).toBeGreaterThanOrEqual(-1e-9); // never below the snow
        if (f.y < 1e-6) { planted ??= f.z; drift = Math.max(drift, Math.abs(f.z - planted)); }
        else planted = null;
      }
      expect(drift).toBeLessThan(0.005);
    }
  });
  it("une jambe en appui tendue, l'autre en élan genou plié, et elles alternent", () => {
    const a = bipedStep(0.4, STRIDE, THIGH, SHIN), b = bipedStep(0.9, STRIDE, THIGH, SHIN); // mid-swing for each leg
    expect(Math.min(a.kneeL, a.kneeR)).toBe(0); expect(Math.max(a.kneeL, a.kneeR)).toBeGreaterThan(0.2);
    expect(a.kneeL === 0).toBe(b.kneeR === 0);
  });
});

describe("gait", () => {
  it("la phase de foulée avance avec la distance, pas avec le temps", () => {
    expect(stridePhase(0, 1)).toBe(0); expect(stridePhase(0.25, 1)).toBeCloseTo(0.25); expect(stridePhase(2.5, 1)).toBeCloseTo(0.5);
    const route: Route = { points: [[0, 0], [10, 0]], loop: false };
    const still = followRoute(startWalker(route), route, 0, 0.05, 4);
    expect(still.distance).toBe(0);
  });
  it("les pattes vont par paires diagonales opposées", () => {
    const [fl, fr, hl, hr] = quadrupedLegs(0.25, 0.5);
    expect(fl).toBeCloseTo(hr); expect(fr).toBeCloseTo(hl); expect(fl).toBeCloseTo(-fr);
  });
  it("chaque bras balance à l'opposé de la jambe du même côté", () => {
    const pose = bipedLimbs(0.25, 0.6);
    expect(Math.sign(pose.armL)).toBe(-Math.sign(pose.legL)); expect(pose.legL).toBeCloseTo(-pose.legR);
  });
  it("suit une route en boucle, borne dt et le lacet", () => {
    const square: Route = { points: [[0, 0], [2, 0], [2, 2], [0, 2]], loop: true };
    let w = startWalker(square);
    w = followRoute(w, square, 1, 10, 100);            // dt énorme → borné à 0,05 s
    expect(w.distance).toBeCloseTo(0.05);
    for (let i = 0; i < 200; i++) w = followRoute(w, square, 1, 0.05, 100);
    expect(w.distance).toBeCloseTo(10.05); expect(w.position[0]).toBeCloseTo(2, 1); expect(w.position[1]).toBeCloseTo(0.05, 1); // 10,05 m = 1 tour de 8 m + 2,05
    const turning = followRoute({ ...startWalker(square), yaw: Math.PI }, square, 1, 0.05, 2);
    expect(Math.abs(turning.yaw - Math.PI)).toBeCloseTo(0.1); // 2 rad/s × 0,05 s
  });
  it("une route ouverte fait demi-tour au bout", () => {
    const line: Route = { points: [[0, 0], [1, 0]], loop: false };
    let w = startWalker(line); for (let i = 0; i < 30; i++) w = followRoute(w, line, 1, 0.05, 100);
    expect(w.forward).toBe(-1); expect(w.position[0]).toBeCloseTo(0.5, 1);
  });
  it("le patineur s'incline d'au plus 0,15 rad et alterne la poussée", () => {
    expect(Math.abs(skateLean(0.25).lean)).toBeCloseTo(0.15);
    expect(Math.sign(skateLean(0.25).push)).toBe(-Math.sign(skateLean(0.75).push));
  });
});
