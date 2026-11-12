import { Sun, Sunset, Moon, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AMBIENCES, AMBIENCE_LABELS, type Ambience } from "@/lib/village-weather";
export type WeatherProps = { ambience: Ambience; onAmbience: (value: Ambience) => void; snow: number; onSnow: (value: number) => void };
export default function WeatherControls({ ambience, onAmbience, snow, onSnow }: WeatherProps) {
  const icons = { day: Sun, dusk: Sunset, night: Moon };
  return <div className="space-y-2">
    <div role="group" aria-label="Ambiance du village" className="flex gap-1">
      {AMBIENCES.map(value => { const Icon = icons[value]; return <Button key={value} variant={ambience === value ? "secondary" : "ghost"} size="sm" aria-pressed={ambience === value} onClick={() => onAmbience(value)} className="flex-1 gap-1 px-2"><Icon className="size-4" />{AMBIENCE_LABELS[value]}</Button>; })}
    </div>
    <label className="flex items-center gap-2 text-xs"><Snowflake className="size-4 shrink-0" /><span>Neige</span><input aria-label="Intensité de la neige" type="range" min="0" max="100" value={snow} onChange={event => onSnow(Number(event.target.value))} className="min-w-0 flex-1 accent-primary" /><span className="w-9 text-right tabular-nums">{snow}%</span></label>
  </div>;
}