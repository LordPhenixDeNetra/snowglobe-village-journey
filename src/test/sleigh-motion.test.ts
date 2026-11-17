import { describe, expect, it } from "vitest";
import { SLEIGH_ARC, sleighDestination, sleighPosition } from "@/lib/sleigh-motion";

describe("personalized tour sleigh", () => {
  it("moves to the catalog's chocolate shop, outside the building", () => {
    expect(sleighDestination("chocolaterie")).toEqual([6.5, 0.2, 0]);
  });
  it("arrives exactly at the selected tour destination", () => {
    const [x, y, z] = sleighPosition([2.5, 0.2, 4], [6.5, 0.2, 0], 1);
    expect(x).toBe(6.5); expect(y).toBeCloseTo(0.2, 10); expect(z).toBeCloseTo(0, 10);
  });
  it("travels between stops rather than teleporting", () => {
    const position = sleighPosition([0, 0.2, 0], [6, 0.2, 4], 0.5);
    // Mid-flight it is SLEIGH_ARC above the ground path, high enough to clear the lamp posts.
    expect(position).toEqual([3, 0.2 + SLEIGH_ARC, 2]);
  });
  it("rejects places outside the personalized village catalog", () => {
    expect(sleighDestination("unknown")).toBeNull();
  });
});