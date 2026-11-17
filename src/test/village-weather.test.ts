import { describe, expect, it } from "vitest";
import { nextAmbience, snowfall, WEATHER_LIGHT } from "@/lib/village-weather";
describe("village weather", () => {
  it("cycles day, dusk and polar night", () => {
    expect(nextAmbience("day")).toBe("dusk");
    expect(nextAmbience("dusk")).toBe("night");
    expect(nextAmbience("night")).toBe("day");
  });
  it("changes light snow into a denser faster storm within bounded particle budgets", () => {
    expect(snowfall(0)).toEqual({ intensity: 0, count: 300, speed: 0.45, wind: 0 });
    expect(snowfall(100).count).toBe(3000);
    expect(snowfall(100).speed).toBeCloseTo(2.25);
    expect(snowfall(100).wind).toBe(2.5);
    expect(snowfall(200)).toEqual(snowfall(100));
    expect(snowfall(-2)).toEqual(snowfall(0));
    expect(snowfall(NaN)).toEqual(snowfall(30));
  });
  it("keeps polar night lit at the scene visibility floor", () => {
    expect(WEATHER_LIGHT.night.ambient).toBe(0.35);
    expect(WEATHER_LIGHT.day.sun).toBeGreaterThan(WEATHER_LIGHT.night.sun);
  });
});
