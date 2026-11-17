import { useState } from "react";
import { Mail, Gift, Paintbrush, Plus, RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSantaLetter } from "@/hooks/use-village-services";
import { AI_NOTICE } from "@/lib/static-site";
import {
  GIFTS,
  ORNAMENT_COLORS,
  type Decoration,
  type OrnamentColor,
  type StarEffect,
} from "@/lib/village-activities";

export type Activity = "letter" | "hunt" | "tree" | null;
export type ActivityProps = {
  activity: Activity;
  onActivity: (activity: Activity) => void;
  found: string[];
  hunting: boolean;
  onHunt: () => void;
  decoration: Decoration;
  onOrnament: (color: OrnamentColor) => void;
  onGarland: () => void;
  onStar: (effect: StarEffect) => void;
  onResetTree: () => void;
};
const colorNames = { red: "Rouge", gold: "Or", blue: "Bleu", green: "Vert" };
export const starNames = { steady: "Fixe", pulse: "Respiration", twinkle: "Scintillante" };

export function SantaLetter() {
  const send = useSantaLetter();
  const [name, setName] = useState("");
  const [letter, setLetter] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !letter.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await send({ name, letter });
      if ("error" in result) setError(result.error);
      else setReply(result.reply);
    } catch {
      setError("Votre lettre n’a pas pu être envoyée. Elle reste à l’écran.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      {reply ? (
        <>
          <article className="santa-parchment" aria-label="Réponse du Père Noël" aria-live="polite">
            <span className="parchment-seal">✦</span>
            <h3 className="mb-3 text-center font-serif text-xl">Un courrier du Pôle Nord</h3>
            <p className="whitespace-pre-line font-serif leading-relaxed">{reply}</p>
          </article>
          <Button variant="outline" onClick={() => setReply("")}>
            Écrire une autre lettre
          </Button>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            Prénom (facultatif)
            <input
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Cher Père Noël…
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              placeholder="Cette année, je souhaite…"
              rows={4}
              maxLength={1500}
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {AI_NOTICE} · Ne partagez pas d’adresse ni de coordonnées.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            className="h-auto min-h-9 w-full whitespace-normal"
            disabled={busy || !letter.trim()}
            type="submit"
          >
            <Send />
            {busy ? "Le Père Noël prépare votre réponse…" : "Envoyer ma lettre"}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ActivityControls(props: ActivityProps) {
  const { activity, onActivity, hunting, found, decoration } = props;
  const [hint, setHint] = useState(false);
  const remaining = GIFTS.find((gift) => !found.includes(gift.id));
  // Radix Tabs never emits an empty value: activating the current tab again deselects it here,
  // before Radix's own mousedown/keydown handlers run (they skip default-prevented events).
  const toggle = (value: Activity) => (event: React.SyntheticEvent) => {
    if (activity !== value) return;
    if (
      "key" in event &&
      (event as React.KeyboardEvent).key !== "Enter" &&
      (event as React.KeyboardEvent).key !== " "
    )
      return;
    event.preventDefault();
    onActivity(null);
  };
  const tab = (value: Activity, Icon: typeof Mail, label: string) => (
    <TabsTrigger
      value={value as string}
      className="min-h-11 gap-1"
      onMouseDown={toggle(value)}
      onKeyDown={toggle(value)}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </TabsTrigger>
  );
  return (
    <Tabs
      value={activity ?? ""}
      onValueChange={(value) => onActivity(value ? (value as Activity) : null)}
      className="space-y-3"
    >
      <TabsList
        aria-label="Activités de Noël"
        className="grid h-auto w-full grid-cols-3 gap-1 bg-muted/60 p-1"
      >
        {tab("letter", Mail, "Poste")}
        {tab("hunt", Gift, "Cadeaux")}
        {tab("tree", Paintbrush, "Sapin")}
      </TabsList>
      <TabsContent value="letter" className="space-y-3">
        <h2 className="text-lg font-semibold">La Poste du Père Noël</h2>
        <SantaLetter />
      </TabsContent>
      <TabsContent value="hunt" className="space-y-3">
        <h2 className="text-lg font-semibold">Chasse aux cadeaux</h2>
        <p className="font-semibold" role="status">
          {found.length} / 5 cadeaux retrouvés
        </p>
        {found.length === 5 && (
          <p className="flex items-center gap-2 text-secondary">
            <Sparkles aria-hidden className="size-4" />
            Tous les cadeaux sont retrouvés !
          </p>
        )}
        <Button
          className="min-h-11 w-full"
          onClick={() => {
            props.onHunt();
            setHint(false);
          }}
        >
          <Gift aria-hidden />
          {hunting ? "Recommencer la chasse" : "Commencer la chasse"}
        </Button>
        {hunting && remaining && (
          <>
            <Button variant="link" className="px-0" onClick={() => setHint(!hint)}>
              {hint ? "Masquer l’indice" : "Un indice"}
            </Button>
            {hint && <p className="text-sm text-muted-foreground">{remaining.hint}</p>}
          </>
        )}
      </TabsContent>
      <TabsContent value="tree" className="space-y-3">
        <h2 className="text-lg font-semibold">Mon Grand Sapin</h2>
        <p className="text-sm text-muted-foreground">Boules · {decoration.ornaments.length} / 60</p>
        <div className="flex gap-2">
          {ORNAMENT_COLORS.map((color) => (
            <Button
              key={color}
              size="icon"
              variant="outline"
              className="min-h-11 min-w-11"
              title={`Ajouter une boule ${colorNames[color].toLowerCase()}`}
              aria-label={`Ajouter une boule ${colorNames[color].toLowerCase()}`}
              disabled={decoration.ornaments.length >= 60}
              onClick={() => props.onOrnament(color)}
            >
              <span className={`ornament-swatch ornament-${color}`} />
              <Plus aria-hidden className="size-3" />
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={decoration.garlands >= 3}
          onClick={props.onGarland}
        >
          <Plus aria-hidden />
          Guirlande · {decoration.garlands} / 3
        </Button>
        <fieldset>
          <legend className="mb-2 text-sm">Étoile</legend>
          <div className="flex flex-wrap gap-2">
            {(["steady", "pulse", "twinkle"] as const).map((effect) => (
              <Button
                key={effect}
                size="sm"
                className="min-h-11"
                variant={decoration.star === effect ? "secondary" : "outline"}
                aria-pressed={decoration.star === effect}
                onClick={() => props.onStar(effect)}
              >
                {starNames[effect]}
              </Button>
            ))}
          </div>
        </fieldset>
        <Button variant="ghost" className="min-h-11" onClick={props.onResetTree}>
          <RotateCcw aria-hidden />
          Réinitialiser le sapin
        </Button>
      </TabsContent>
    </Tabs>
  );
}
