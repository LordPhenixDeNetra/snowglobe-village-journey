import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AROverlay, { type ARActions, type ARState } from "@/components/xr/AROverlay";
import ActionBar from "@/components/shell/ActionBar";

// Server functions are not called here; the mock only lets the modules load in jsdom.
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(), createServerFn: () => ({ inputValidator: () => ({ handler: () => vi.fn() }) }) }));

const arState: ARState = {
  placed: false, found: false, tracking: false, focusName: "La Chocolaterie", note: "Miam.", step: 0, count: 3,
  audio: { enabled: false, busy: false, speaking: false, error: null }, scale: 0.025, rotationDeg: 0, ambience: "night", snow: 30,
  activities: { activity: null, onActivity: vi.fn(), found: [], hunting: false, onHunt: vi.fn(), decoration: { ornaments: [], garlands: 0, star: "pulse" }, onOrnament: vi.fn(), onGarland: vi.fn(), onStar: vi.fn(), onResetTree: vi.fn() },
};
const arActions: ARActions = { place: vi.fn(), reposition: vi.fn(), exit: vi.fn(), onStep: vi.fn(), startAudio: vi.fn(), stopAudio: vi.fn(), repeat: vi.fn(), onScale: vi.fn(), onRotation: vi.fn(), onAmbience: vi.fn(), onSnow: vi.fn() };

describe("overlay AR", () => {
  it("avant la pose : statut et bouton Poser désactivé tant qu'aucune surface", () => {
    const { rerender } = render(<AROverlay state={{ ...arState, placed: false, found: false }} actions={arActions} />);
    expect(screen.getByRole("status")).toHaveTextContent("Recherche d’une surface horizontale…");
    expect(screen.getByRole("button", { name: "Poser le village" })).toBeDisabled();
    rerender(<AROverlay state={{ ...arState, placed: false, found: true }} actions={arActions} />);
    expect(screen.getByRole("status")).toHaveTextContent("Surface détectée");
    fireEvent.click(screen.getByRole("button", { name: "Poser le village" })); expect(arActions.place).toHaveBeenCalled();
  });
  it("après la pose : cinq entrées, Quitter à part, tiroir monté dans l'overlay", () => {
    render(<AROverlay state={{ ...arState, placed: true }} actions={arActions} />);
    const nav = screen.getByRole("navigation", { name: "Actions du village" });
    expect(within(nav).getAllByRole("button").map(b => b.textContent)).toEqual(["Parcours", "Activités", "Ambiance", "Conteur", "Maquette"]);
    expect(within(nav).queryByRole("button", { name: /Quitter/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Maquette" }));
    const root = screen.getByTestId("ar-overlay");
    expect(root.contains(screen.getByRole("dialog", { name: "Maquette" }))).toBe(true);
    expect(screen.getByRole("slider", { name: "Taille de la maquette" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Quitter l.AR/ })); expect(arActions.exit).toHaveBeenCalled();
  });
  it("un tap sur l'overlay ne déclenche pas la sélection XR", () => {
    render(<AROverlay state={{ ...arState, placed: true }} actions={arActions} />);
    const event = new Event("beforexrselect", { cancelable: true }); screen.getByTestId("ar-overlay").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("signale la perte de suivi après la pose", () => {
    render(<AROverlay state={{ ...arState, placed: true, tracking: true }} actions={arActions} />);
    expect(screen.getByRole("status")).toHaveTextContent("Suivi interrompu…");
  });
  it("ActionBar sans items garde les cinq entrées desktop", () => {
    const panels = { tour: <p>P</p>, activities: <p>A</p>, ambience: <p>M</p>, music: <p>Mu</p>, immersion: <p>I</p> };
    render(<ActionBar open={null} onOpen={vi.fn()} hunting={false} found={0} panels={panels} />);
    const nav = screen.getByRole("navigation", { name: "Actions du village" });
    expect(within(nav).getAllByRole("button").map(b => b.textContent)).toEqual(["Parcours", "Activités", "Ambiance", "Musique", "Immersion"]);
    expect(screen.getByText("Village de Noël")).toBeInTheDocument();
  });
});
