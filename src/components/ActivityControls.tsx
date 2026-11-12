import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Gift, Paintbrush, Plus, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { writeSantaLetter } from "@/lib/santa-letter.functions";
import { GIFTS, ORNAMENT_COLORS, type Decoration, type OrnamentColor, type StarEffect } from "@/lib/village-activities";

export type Activity = "letter" | "hunt" | "tree" | null;
export type ActivityProps = {
  activity: Activity; onActivity: (activity: Activity) => void;
  found: string[]; hunting: boolean; onHunt: () => void;
  decoration: Decoration; onOrnament: (color: OrnamentColor) => void;
  onGarland: () => void; onStar: (effect: StarEffect) => void; onResetTree: () => void;
};
const colorNames = { red: "Rouge", gold: "Or", blue: "Bleu", green: "Vert" };
export const starNames = { steady: "Fixe", pulse: "Respiration", twinkle: "Scintillante" };

export function SantaLetter() {
  const send = useServerFn(writeSantaLetter);
  const [name, setName] = useState("");
  const [letter, setLetter] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy || !letter.trim()) return;
    setBusy(true); setError("");
    try { const result = await send({ data: { name, letter } }); if ("error" in result) setError(result.error); else setReply(result.reply); }
    catch { setError("Votre lettre n’a pas pu être envoyée. Elle reste à l’écran."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    {reply ? <><article className="santa-parchment" aria-label="Réponse du Père Noël" aria-live="polite"><span className="parchment-seal">✦</span><h3 className="mb-3 text-center font-serif text-xl">Un courrier du Pôle Nord</h3><p className="whitespace-pre-line font-serif leading-relaxed">{reply}</p></article><Button variant="outline" onClick={() => setReply("")}>Écrire une autre lettre</Button></> :
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">Prénom (facultatif)<input className="mt-1 w-full rounded-md border border-input bg-background p-2" maxLength={60} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block text-sm">Cher Père Noël…<textarea className="mt-1 w-full rounded-md border border-input bg-background p-2" placeholder="Cette année, je souhaite…" rows={4} maxLength={1500} value={letter} onChange={e => setLetter(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">Réponse imaginaire générée par IA · Ne partagez pas d’adresse ni de coordonnées.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="h-auto min-h-9 w-full whitespace-normal" disabled={busy || !letter.trim()} type="submit"><Send />{busy ? "Le Père Noël prépare votre réponse…" : "Envoyer ma lettre"}</Button>
    </form>}
  </div>;
}

export default function ActivityControls(props: ActivityProps) {
  const { activity, onActivity, hunting, found, decoration } = props;
  const [hint, setHint] = useState(false);
  const remaining = GIFTS.find(gift => !found.includes(gift.id));
  return <section className="space-y-3">
    <nav className="grid grid-cols-3 gap-1" aria-label="Activités de Noël">
      <Button variant={activity === "letter" ? "default" : "outline"} size="sm" onClick={() => onActivity(activity === "letter" ? null : "letter")}><Mail />Poste</Button>
      <Button variant={activity === "hunt" ? "default" : "outline"} size="sm" onClick={() => onActivity(activity === "hunt" ? null : "hunt")}><Gift />Cadeaux</Button>
      <Button variant={activity === "tree" ? "default" : "outline"} size="sm" onClick={() => onActivity(activity === "tree" ? null : "tree")}><Paintbrush />Sapin</Button>
    </nav>
    {activity === "letter" && <><h2 className="font-semibold">La Poste du Père Noël</h2><SantaLetter /></>}
    {activity === "hunt" && <div className="space-y-3"><h2 className="font-semibold">Chasse aux cadeaux</h2><p className="font-semibold" role="status">{found.length} / 5 cadeaux retrouvés</p>{found.length === 5 && <p className="text-secondary">Tous les cadeaux sont retrouvés ! ✨</p>}<Button onClick={() => { props.onHunt(); setHint(false); }}><Gift />{hunting ? "Recommencer la chasse" : "Commencer la chasse"}</Button>{hunting && remaining && <><Button variant="link" onClick={() => setHint(!hint)}>{hint ? "Masquer l’indice" : "Un indice"}</Button>{hint && <p className="text-sm text-muted-foreground">{remaining.hint}</p>}</>}</div>}
    {activity === "tree" && <div className="space-y-3"><h2 className="font-semibold">Mon Grand Sapin</h2><p className="text-sm text-muted-foreground">Boules · {decoration.ornaments.length} / 60</p><div className="flex gap-2">{ORNAMENT_COLORS.map(color => <Button key={color} size="icon" variant="outline" title={`Ajouter une boule ${colorNames[color].toLowerCase()}`} aria-label={`Ajouter une boule ${colorNames[color].toLowerCase()}`} disabled={decoration.ornaments.length >= 60} onClick={() => props.onOrnament(color)}><span className={`ornament-swatch ornament-${color}`} /><Plus className="size-3" /></Button>)}</div><Button variant="outline" disabled={decoration.garlands >= 3} onClick={props.onGarland}><Plus />Guirlande · {decoration.garlands} / 3</Button><fieldset><legend className="mb-2 text-sm">Étoile</legend><div className="flex flex-wrap gap-1">{(["steady", "pulse", "twinkle"] as const).map(effect => <Button key={effect} size="sm" variant={decoration.star === effect ? "secondary" : "outline"} aria-pressed={decoration.star === effect} onClick={() => props.onStar(effect)}>{starNames[effect]}</Button>)}</div></fieldset><Button variant="ghost" onClick={props.onResetTree}><RotateCcw />Réinitialiser le sapin</Button></div>}
  </section>;
}