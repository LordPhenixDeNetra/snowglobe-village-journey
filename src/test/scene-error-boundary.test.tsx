import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SceneErrorBoundary } from "@/components/scene/SceneErrorBoundary";

function Broken(): never { throw new Error("404 sleigh.glb"); }

describe("limite d'erreur de scène", () => {
  afterEach(() => vi.restoreAllMocks());
  it("un élément qui échoue disparaît, ses voisins restent, l'erreur est signalée", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<><p>village</p><SceneErrorBoundary><Broken /></SceneErrorBoundary></>);
    expect(screen.getByText("village")).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith("Scene element failed to load", expect.any(Error));
  });
  it("rend le repli s'il est fourni, et l'enfant sain normalement", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<><SceneErrorBoundary fallback={<p>repli</p>}><Broken /></SceneErrorBoundary><SceneErrorBoundary><p>traîneau</p></SceneErrorBoundary></>);
    expect(screen.getByText("repli")).toBeInTheDocument();
    expect(screen.getByText("traîneau")).toBeInTheDocument();
  });
});
