import { useServerFn } from "@tanstack/react-start";
import { planTour, type TourResult } from "@/lib/tour.functions";
import { writeSantaLetter } from "@/lib/santa-letter.functions";
import { planTourOffline } from "@/lib/offline-tour";
import { writeLetterOffline } from "@/lib/offline-letter";
import { STATIC_SITE } from "@/lib/static-site";

type LetterResult = { reply: string } | { error: string };

/** The AI tour planner online; the offline themed tours on the static GitHub Pages build. */
export function usePlanTour(): (wish: string) => Promise<TourResult> {
  const server = useServerFn(planTour);
  return STATIC_SITE ? async (wish) => planTourOffline(wish) : (wish) => server({ data: { wish } });
}

/** Santa's AI reply online; the offline template reply on the static GitHub Pages build. */
export function useSantaLetter(): (letter: {
  name: string;
  letter: string;
}) => Promise<LetterResult> {
  const server = useServerFn(writeSantaLetter);
  return STATIC_SITE ? async (data) => writeLetterOffline(data) : (data) => server({ data });
}
