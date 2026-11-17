import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WelcomeScreen from "@/components/shell/WelcomeScreen";
import ActionBar, { type PanelId } from "@/components/shell/ActionBar";
import TourChip from "@/components/shell/TourChip";
import { TourPanel } from "@/components/shell/panels";
import ActivityControls from "@/components/ActivityControls";
import WeatherControls from "@/components/WeatherControls";
import { MusicControls } from "@/components/ChristmasMusic";

// Server functions are not called here; the mock only lets the modules load in jsdom.
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(), createServerFn: () => ({ inputValidator: () => ({ handler: () => vi.fn() }) }) }));

describe("contenus de panneaux", () => {
  it("activités : onglets accessibles sans emoji, Cadeaux affiche le compteur", () => {
    const onActivity = vi.fn();
    const props = { activity: "hunt" as const, onActivity, found: ["chocolat"], hunting: true, onHunt: vi.fn(), decoration: { ornaments: [], garlands: 0, star: "pulse" as const }, onOrnament: vi.fn(), onGarland: vi.fn(), onStar: vi.fn(), onResetTree: vi.fn() };
    render(<ActivityControls {...props} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Poste" }));
    expect(onActivity).toHaveBeenCalledWith("letter");
    expect(screen.getByRole("status")).toHaveTextContent("1 / 5 cadeaux retrouvés");
    expect(document.body.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}✨]/u);
  });
  it("activités : recliquer l'onglet actif désélectionne l'activité", () => {
    const onActivity = vi.fn();
    const props = { activity: "hunt" as const, onActivity, found: [], hunting: false, onHunt: vi.fn(), decoration: { ornaments: [], garlands: 0, star: "pulse" as const }, onOrnament: vi.fn(), onGarland: vi.fn(), onStar: vi.fn(), onResetTree: vi.fn() };
    render(<ActivityControls {...props} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Cadeaux" }));
    expect(onActivity).toHaveBeenCalledWith(null);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Cadeaux" }), { key: "Enter" });
    expect(onActivity).toHaveBeenCalledTimes(2);
  });
  it("ambiance : groupe à bascule et curseur étiquetés", () => {
    const onAmbience = vi.fn();
    render(<WeatherControls ambience="night" onAmbience={onAmbience} snow={30} onSnow={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Nuit polaire" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Jour" }));
    expect(onAmbience).toHaveBeenCalledWith("day");
    expect(screen.getByRole("slider", { name: "Intensité de la neige" })).toHaveAttribute("aria-valuenow", "30");
  });
  it("musique : les contrôles ne possèdent pas l'élément audio", () => {
    const toggle = vi.fn(async () => {});
    render(<MusicControls audioRef={{ current: null }} playing={false} volume={35} error={false} toggle={toggle} setVolume={vi.fn()} />);
    expect(document.querySelector("audio")).toBeNull();
    const button = screen.getByRole("button", { name: "Activer la musique de Noël" });
    expect(button).toHaveTextContent("Activer la musique de Noël");
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalled();
  });
});

const panels = { tour: <p>P</p>, activities: <p>A</p>, ambience: <p>M</p>, music: <p>Mu</p>, immersion: <p>I</p> };

describe("barre d'actions", () => {
  it("ouvre un seul panneau, marque l'entrée active, Escape referme et rend le focus", () => {
    const Harness = () => { const [open, setOpen] = useState<PanelId | null>(null); return <ActionBar open={open} onOpen={setOpen} hunting={false} found={0} panels={panels} />; };
    render(<Harness />);
    const tour = screen.getByRole("button", { name: "Parcours" });
    fireEvent.click(tour);
    expect(tour).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("dialog", { name: "Parcours" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activités" }));
    expect(screen.queryByRole("dialog", { name: "Parcours" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Activités" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activités" })).toHaveFocus();
  });
  it("place le panneau après la barre dans le DOM pour que Tab y entre", () => {
    render(<ActionBar open="tour" onOpen={vi.fn()} hunting={false} found={0} panels={panels} />);
    const bar = screen.getByRole("navigation", { name: "Actions du village" });
    const dialog = screen.getByRole("dialog", { name: "Parcours" });
    expect(bar.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("affiche le compteur de cadeaux pendant la chasse", () => {
    render(<ActionBar open={null} onOpen={vi.fn()} hunting found={3} panels={panels} />);
    expect(screen.getByLabelText("3 cadeaux sur 5")).toBeInTheDocument();
  });
});

describe("panneau parcours et puce", () => {
  it("affiche l'erreur, désactive sans souhait, puis montre l'étape et navigue", () => {
    const onStep = vi.fn();
    const base = { step: 0, wish: "", onWish: vi.fn(), loading: false, onPlan: vi.fn(), onStep, onReset: vi.fn() };
    const { rerender } = render(<TourPanel {...base} tour={null} focusName={undefined} note={undefined} error="Le guide n'a pas pu préparer votre parcours." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Le guide n'a pas pu préparer votre parcours.");
    expect(screen.getByRole("button", { name: "Créer mon parcours" })).toBeDisabled();
    rerender(<TourPanel {...base} tour={{ title: "Douceurs", stops: [{ id: "chocolaterie", note: "Miam." }, { id: "boulangerie", note: "Pain." }] }} focusName="La Chocolaterie" note="Miam." error={null} />);
    expect(screen.getByText("1. La Chocolaterie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Précédent" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(onStep).toHaveBeenCalledWith(1);
  });
  it("la puce montre l'étape, navigue et ouvre le panneau", () => {
    const onStep = vi.fn(), onOpen = vi.fn();
    render(<TourChip step={1} count={4} name="La Chocolaterie" onStep={onStep} onOpen={onOpen} />);
    const stop = screen.getByRole("button", { name: "2/4 · La Chocolaterie" });
    expect(stop).toHaveAttribute("title", "2/4 · La Chocolaterie");
    expect(stop.querySelector(".truncate")).toHaveTextContent("2/4 · La Chocolaterie");
    fireEvent.click(stop);
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Étape précédente" }));
    expect(onStep).toHaveBeenCalledWith(-1);
  });
});

const welcome = { wish: "", onWish: vi.fn(), loading: false, error: null, onPlan: vi.fn(), onEnter: vi.fn(), vrSupported: true, arSupported: false, entering: false, onXR: vi.fn(), xrError: null };

describe("écran d'accueil", () => {
  it("désactive le parcours sans souhait, propose la visite libre et signale l'AR indisponible", () => {
    render(<WelcomeScreen {...welcome} />);
    expect(screen.getByRole("heading", { level: 1, name: "Village de Noël" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer mon parcours" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Visiter librement" }));
    expect(welcome.onEnter).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "AR indisponible" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Entrer en VR" })).toBeEnabled();
  });
  it("reste désactivé avec un souhait d'espaces et affiche l'erreur près du champ", () => {
    render(<WelcomeScreen {...welcome} wish="   " error="Le guide est momentanément indisponible." />);
    expect(screen.getByRole("button", { name: "Créer mon parcours" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Le guide est momentanément indisponible.");
  });
});
