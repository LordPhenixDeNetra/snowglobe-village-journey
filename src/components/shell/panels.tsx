import { Button } from "@/components/ui/button";
import type { TourStop } from "@/lib/tour.functions";
import { WishForm, XRButtons, type WishFormProps, type XRButtonsProps } from "./WelcomeScreen";

export function TourPanel({ tour, step, focusName, note, onStep, onReset, ...form }: WishFormProps & {
  tour: { title: string; stops: TourStop[] } | null; step: number; focusName: string | undefined; note: string | undefined;
  onStep: (direction: number) => void; onReset: () => void;
}) {
  if (!tour) return <WishForm {...form} />;
  return <div className="space-y-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{tour.title}</p>
    <p className="font-heading text-lg font-semibold">{step + 1}. {focusName}</p>
    {note && <p className="text-base">{note}</p>}
    <div className="flex gap-2">
      <Button variant="secondary" className="min-h-11 flex-1" disabled={step === 0} onClick={() => onStep(-1)}>Précédent</Button>
      <Button className="min-h-11 flex-1" disabled={step >= tour.stops.length - 1} onClick={() => onStep(1)}>Suivant</Button>
    </div>
    <p className="text-xs text-muted-foreground">Étape {step + 1} / {tour.stops.length}</p>
    <Button variant="link" className="px-0" onClick={onReset}>Nouveau parcours</Button>
  </div>;
}

export function ImmersionPanel(props: XRButtonsProps) {
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Créez d'abord un parcours pour le suivre dans le casque ou sur la table.</p>
    <XRButtons {...props} />
  </div>;
}
