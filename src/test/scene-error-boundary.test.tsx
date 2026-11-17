import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SceneErrorBoundary } from "@/components/scene/SceneErrorBoundary";

function Broken(): never {
  throw new Error("404 sleigh.glb");
}

describe("limite d'erreur de scène", () => {
  afterEach(() => vi.restoreAllMocks());
  it("un élément qui échoue disparaît, ses voisins restent, l'erreur est signalée", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <>
        <p>village</p>
        <SceneErrorBoundary>
          <Broken />
        </SceneErrorBoundary>
      </>,
    );
    expect(screen.getByText("village")).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith("Scene element failed to load", expect.any(Error));
  });
  it("rend le repli s'il est fourni, et l'enfant sain normalement", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <>
        <SceneErrorBoundary fallback={<p>repli</p>}>
          <Broken />
        </SceneErrorBoundary>
        <SceneErrorBoundary>
          <p>traîneau</p>
        </SceneErrorBoundary>
      </>,
    );
    expect(screen.getByText("repli")).toBeInTheDocument();
    expect(screen.getByText("traîneau")).toBeInTheDocument();
  });
  it("réessaie après un délai qui double, puis abandonne au-delà des tentatives prévues", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let failures = 2;
    const onRetry = vi.fn();
    function Flaky() {
      if (failures > 0) throw new Error("network");
      return <p>traîneau</p>;
    }
    render(
      <SceneErrorBoundary
        retries={3}
        retryDelayMs={1000}
        onRetry={() => {
          onRetry();
          failures--;
        }}
      >
        <Flaky />
      </SceneErrorBoundary>,
    );
    expect(screen.queryByText("traîneau")).toBeNull();
    act(() => vi.advanceTimersByTime(999));
    expect(onRetry).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(2000)); // second attempt waits twice as long
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(screen.getByText("traîneau")).toBeInTheDocument();
    vi.useRealTimers();
  });
  it("s'arrête après le nombre de tentatives prévu", () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const onRetry = vi.fn();
    render(
      <SceneErrorBoundary retries={2} retryDelayMs={100} onRetry={onRetry}>
        <Broken />
      </SceneErrorBoundary>,
    );
    // React re-renders when act() exits, so each new attempt is scheduled between steps.
    for (let i = 0; i < 6; i++) act(() => vi.advanceTimersByTime(10_000));
    expect(onRetry).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
