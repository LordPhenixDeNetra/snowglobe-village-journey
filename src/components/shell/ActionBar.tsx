import { useEffect, useRef, type ReactNode } from "react";
import { Compass, Gift, Headset, Moon, Music2, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { GIFTS } from "@/lib/village-activities";
import { cn } from "@/lib/utils";

export type PanelId = "tour" | "activities" | "ambience" | "music" | "immersion";
export type ActionItem<T extends string = PanelId> = { id: T; title: string; icon: LucideIcon };
export type ActionBarProps<T extends string = PanelId> = {
  open: T | null;
  onOpen: (id: T | null) => void;
  hunting: boolean;
  found: number;
  panels: Record<T, ReactNode>;
  titles?: Partial<Record<T, string>>;
  /** Entries of the bar; defaults to the desktop/mobile five. */
  items?: ActionItem<T>[];
  /** Inside the AR DOM overlay: the panel docks above the bar, in the overlay's own subtree (no drawer, no portal). */
  docked?: boolean;
  brand?: boolean;
};

const ITEMS: ActionItem[] = [
  { id: "tour", title: "Parcours", icon: Compass },
  { id: "activities", title: "Activités", icon: Gift },
  { id: "ambience", title: "Ambiance", icon: Moon },
  { id: "music", title: "Musique", icon: Music2 },
  { id: "immersion", title: "Immersion", icon: Headset },
];
const BAR_LABEL = "Actions du village";

export default function ActionBar<T extends string = PanelId>({
  open,
  onOpen,
  hunting,
  found,
  panels,
  titles,
  items = ITEMS as ActionItem<T>[],
  docked = false,
  brand = true,
}: ActionBarProps<T>) {
  const bar = useRef<HTMLElement>(null);
  // Read here, long before a panel opens, so a phone never shows one frame of the desktop card first.
  const mobile = useIsMobile() && !docked;
  const title = (id: T) => titles?.[id] ?? items.find((item) => item.id === id)?.title ?? id;
  // Closing returns focus to the entry that opened the panel, so keyboard users never lose their place.
  function close() {
    if (!open) return;
    const id = open;
    onOpen(null);
    bar.current?.querySelector<HTMLButtonElement>(`[data-panel="${id}"]`)?.focus();
  }
  return (
    <>
      {/* Hidden on phones: the tour chip needs that width. The welcome screen already carries the title. */}
      {brand && (
        <p className="glass pointer-events-none absolute left-4 top-4 z-10 hidden rounded-full px-3 py-1 font-heading text-lg font-semibold text-primary sm:block">
          Village de Noël
        </p>
      )}
      <nav
        ref={bar}
        aria-label={BAR_LABEL}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:pb-4"
      >
        <div className="glass pointer-events-auto grid w-full max-w-lg grid-cols-5 gap-2 rounded-2xl p-2">
          {items.map(({ id, icon: Icon }) => {
            return (
              <Button
                key={id}
                variant="ghost"
                data-panel={id}
                aria-pressed={open === id}
                onClick={() => (open === id ? close() : onOpen(id))}
                className="relative h-auto min-h-11 flex-col gap-1 px-1 py-2 text-xs aria-pressed:bg-accent aria-pressed:text-accent-foreground [&_svg]:size-5"
              >
                <Icon aria-hidden />
                {title(id)}
                {id === "activities" && hunting && (
                  <span
                    aria-label={`${found} cadeaux sur ${GIFTS.length}`}
                    className="absolute -top-1 right-1 rounded-full bg-primary px-1.5 text-xs font-bold leading-5 text-primary-foreground"
                  >
                    {found}/{GIFTS.length}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </nav>
      {/* After the bar in DOM order so Tab moves from the active entry into the panel. */}
      {open && (
        <Panel id={open} title={title(open)} open onClose={close} mobile={mobile} docked={docked}>
          {panels[open]}
        </Panel>
      )}
    </>
  );
}

export function Panel({
  id,
  title,
  open,
  onClose,
  children,
  mobile,
  docked = false,
}: {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  mobile: boolean;
  docked?: boolean;
}) {
  // Docked (AR DOM overlay): a card above the bar, not vaul's drawer, which stays modal (it hides the rest of the
  // overlay, including "Quitter l'AR"), draws a scrim over the camera and portals out of the overlay subtree.
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open || mobile) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        panel.current?.contains(target) ||
        document.querySelector(`nav[aria-label="${BAR_LABEL}"]`)?.contains(target)
      )
        return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, mobile, onClose]);
  if (mobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
        shouldScaleBackground={false}
      >
        <DrawerContent
          className="max-h-[80dvh] border-border bg-popover text-popover-foreground backdrop-blur-xl"
          aria-describedby={undefined}
        >
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-heading">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  const card = (
    <section
      ref={panel}
      role="dialog"
      aria-labelledby={`panel-${id}-title`}
      className={cn(
        "glass absolute left-1/2 z-10 -translate-x-1/2 overflow-y-auto rounded-2xl p-4 motion-safe:animate-in",
        docked
          ? "pointer-events-auto bottom-[calc(5.5rem+env(safe-area-inset-bottom))] max-h-[55dvh] w-[min(32rem,calc(100%-2*max(0.5rem,env(safe-area-inset-left),env(safe-area-inset-right))))]"
          : "bottom-24 max-h-[60dvh] w-[min(360px,calc(100%-2rem))]",
        " motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id={`panel-${id}-title`} className="text-xl font-semibold">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label="Fermer"
          title="Fermer"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </header>
      {children}
    </section>
  );
  return card;
}
