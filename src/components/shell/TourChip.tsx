import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TourChip({ step, count, name, onStep, onOpen }: { step: number; count: number; name: string; onStep: (direction: number) => void; onOpen: () => void }) {
  return <div className="glass absolute left-1/2 top-4 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 rounded-full p-1">
    <Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-full" aria-label="Étape précédente" title="Étape précédente" disabled={step === 0} onClick={() => onStep(-1)}><ChevronLeft aria-hidden /></Button>
    <Button variant="ghost" className="min-h-11 rounded-full px-3 text-sm font-semibold" onClick={onOpen}>{step + 1}/{count} · {name}</Button>
    <Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-full" aria-label="Étape suivante" title="Étape suivante" disabled={step >= count - 1} onClick={() => onStep(1)}><ChevronRight aria-hidden /></Button>
  </div>;
}
