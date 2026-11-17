import { Sun, Sunset, Moon, Snowflake } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AMBIENCES, AMBIENCE_LABELS, type Ambience } from "@/lib/village-weather";
export type WeatherProps = { ambience: Ambience; onAmbience: (value: Ambience) => void; snow: number; onSnow: (value: number) => void };
export default function WeatherControls({ ambience, onAmbience, snow, onSnow }: WeatherProps) {
  const icons = { day: Sun, dusk: Sunset, night: Moon };
  return <div className="space-y-3">
    <ToggleGroup type="single" variant="outline" value={ambience} onValueChange={value => { if (value) onAmbience(value as Ambience); }} aria-label="Ambiance du village" className="grid grid-cols-3 gap-2">
      {AMBIENCES.map(value => { const Icon = icons[value]; return <ToggleGroupItem key={value} value={value} className="h-auto min-h-11 gap-1 whitespace-nowrap px-1.5 text-[0.8125rem] leading-tight data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"><Icon aria-hidden className="size-4" />{AMBIENCE_LABELS[value]}</ToggleGroupItem>; })}
    </ToggleGroup>
    <div className="flex items-center gap-3 text-sm"><Snowflake aria-hidden className="size-4 shrink-0" /><span>Neige</span><Slider aria-label="Intensité de la neige" min={0} max={100} step={1} value={[snow]} onValueChange={([value]) => onSnow(value ?? snow)} className="min-w-0 flex-1" /><span className="w-10 text-right tabular-nums">{snow}%</span></div>
  </div>;
}
