import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/village-places";
import { safeLanding, viewpoint, scaleForAR } from "@/lib/xr-navigation";

describe("immersive navigation", () => {
  it("keeps every quick viewpoint on safe ground at visitor foot level", () => {
    for (const place of PLACES) {
      const [x, y, z] = viewpoint(place);
      expect(y).toBe(0);
      expect(safeLanding(x, z)).toBe(true);
    }
  });
  it("rejects the tree, houses, forest and invalid destinations", () => {
    expect(safeLanding(0, 0)).toBe(false);
    expect(safeLanding(9, 0)).toBe(false);
    expect(safeLanding(20, 0)).toBe(false);
    expect(safeLanding(NaN, 3)).toBe(false);
    expect(safeLanding(0, 6)).toBe(true);
  });
  it("keeps the AR village at tabletop scale", () => {
    expect(scaleForAR(0.025)).toBe(0.025);
    expect(scaleForAR(0)).toBe(0.015);
    expect(scaleForAR(1)).toBe(0.05);
    expect(scaleForAR(NaN)).toBe(0.025);
  });
});