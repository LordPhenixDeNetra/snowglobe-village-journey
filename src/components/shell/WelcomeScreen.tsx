import { ArrowRight, Headset, Smartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type WishFormProps = { wish: string; onWish: (value: string) => void; loading: boolean; error: string | null; onPlan: () => void };
export type XRButtonsProps = { vrSupported: boolean | undefined; arSupported: boolean | undefined; entering: boolean; onXR: (mode: "VR" | "AR") => void; xrError: string | null };
export type WelcomeProps = WishFormProps & XRButtonsProps & { onEnter: () => void };

// Shared by the welcome card and the tour panel.
export function WishForm({ wish, onWish, loading, error, onPlan, children }: WishFormProps & { children?: React.ReactNode }) {
  return <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (wish.trim() && !loading) onPlan(); }}>
    <label className="block space-y-2">
      <span className="font-heading text-lg">Que souhaitez-vous découvrir ?</span>
      <Textarea value={wish} onChange={event => onWish(event.target.value)} maxLength={500} rows={3} placeholder="Ex. : des douceurs sucrées et des jeux pour les enfants" className="text-base" />
    </label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="submit" disabled={loading || !wish.trim()} className="h-auto min-h-11 flex-1 whitespace-normal text-base"><Sparkles aria-hidden />{loading ? "Le guide prépare votre parcours…" : "Créer mon parcours"}</Button>
      {children}
    </div>
  </form>;
}

export function XRButtons({ vrSupported, arSupported, entering, onXR, xrError }: XRButtonsProps) {
  const label = (supported: boolean | undefined, mode: "VR" | "AR") => supported === undefined ? `Vérification ${mode}…` : supported ? `Entrer en ${mode}` : `${mode} indisponible`;
  return <div className="space-y-2">
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
      <Button variant="secondary" className="h-auto min-h-11 flex-1 whitespace-normal px-3 text-base" disabled={entering || !vrSupported} onClick={() => onXR("VR")}><Headset aria-hidden />{label(vrSupported, "VR")}</Button>
      <Button variant="secondary" className="h-auto min-h-11 flex-1 whitespace-normal px-3 text-base" disabled={entering || !arSupported} onClick={() => onXR("AR")}><Smartphone aria-hidden />{label(arSupported, "AR")}</Button>
    </div>
    {xrError && <p role="alert" className="text-sm text-destructive">{xrError}</p>}
  </div>;
}

export default function WelcomeScreen({ onEnter, ...props }: WelcomeProps) {
  return <section role="dialog" aria-labelledby="welcome-title" className="absolute inset-0 z-20 flex justify-center overflow-y-auto bg-background/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
    {/* my-auto instead of items-center: a card taller than the viewport (phone landscape) stays scrollable from its top. */}
    <div className="glass my-auto w-full max-w-xl space-y-5 rounded-2xl p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500">
      <header className="space-y-1 text-center">
        <h1 id="welcome-title" className="text-[2.5rem] font-semibold leading-tight tracking-wide text-primary drop-shadow sm:text-5xl">Village de Noël</h1>
        <p className="text-base text-muted-foreground">Une promenade magique, en 3D, en VR ou en AR</p>
      </header>
      <WishForm {...props}>
        <Button type="button" variant="outline" className="min-h-11 flex-1 text-base" onClick={onEnter}>Visiter librement<ArrowRight aria-hidden /></Button>
      </WishForm>
      <XRButtons {...props} />
      <p className="text-center text-[0.8125rem] text-muted-foreground">Musique et sons démarrent sur votre geste · Expérience WebXR</p>
    </div>
  </section>;
}
