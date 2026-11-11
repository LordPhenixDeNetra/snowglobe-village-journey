import { describe, expect, it } from "vitest";
import { sleighDestination, sleighPosition } from "@/lib/sleigh-motion";

describe("personalized tour sleigh", () => {
  it("moves to the catalog's chocolate shop, outside the building", () => {
    expect(sleighDestination("chocolaterie")).toEqual([6.5, 0.2, 0]);
  });
  it("arrives exactly at the selected tour destination", () => {
    expect(sleighPosition([2.5, 0.2, 4], [6.5, 0.2, 0], 1)).toEqual([6.5, 0.20000000000000026, 0]);
  });
  it("travels between stops rather than teleporting", () => {
    const position = sleighPosition([0, 0.2, 0], [6, 0.2, 4], 0.5);
    expect(position).toEqual([3, 2.2, 2]);
  });
  it("rejects places outside the personalized village catalog", () => {
    expect(sleighDestination("unknown")).toBeNull();
  });
});