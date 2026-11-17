import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWeatherColors } from "@/components/VillageWeather";

describe("couleurs de scène", () => {
  afterEach(() => vi.restoreAllMocks());
  it("sont disponibles dès le premier rendu (pas d'image noire au montage)", () => {
    // jsdom has no 2D canvas: stub one that reads every token as pure red.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray([255, 0, 0, 255]) }),
    } as unknown as CanvasRenderingContext2D);
    const firstRender: string[][] = [];
    function Probe() {
      firstRender.push(Object.keys(useWeatherColors()));
      return null;
    }
    render(<Probe />);
    expect(firstRender[0]).toEqual(
      expect.arrayContaining(["snow", "gold", "lantern", "aurora-green"]),
    );
  });
});
