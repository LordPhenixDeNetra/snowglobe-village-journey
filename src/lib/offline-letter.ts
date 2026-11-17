import { letterSchema } from "./village-activities";

// Offline stand-in for Santa's AI reply (static hosting has no server). Same validation as the server
// function; the letter is only read in the browser and never stored.

/** The sentence that carries a wish, without its lead-in ("je voudrais …" → "…"). */
function quotedWish(letter: string): string | null {
  const sentences = letter
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lead =
    /\b(?:je (?:voudrais|souhaite|veux|r[êe]ve d['e]|r[êe]ve de|aimerais)|j'aimerais|mon r[êe]ve (?:est|serait))\s+/i;
  for (const sentence of sentences) {
    const match = lead.exec(sentence);
    if (match) {
      const wish = sentence
        .slice(match.index + match[0].length)
        .replace(/[.!?]+$/, "")
        .trim();
      if (wish) return wish.length > 90 ? `${wish.slice(0, 87).trimEnd()}…` : wish;
    }
  }
  return null;
}

export function writeLetterOffline(input: {
  name?: string;
  letter: string;
}): { reply: string } | { error: string } {
  const parsed = letterSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Votre lettre n'a pas pu être lue." };
  const { name, letter } = parsed.data;
  const wish = quotedWish(letter);
  const greeting = name ? `Cher ${name},` : "Cher visiteur,";
  const wishLine = wish
    ? `Tu me parles de ${wish} : je l'ai noté dans mon grand carnet, entre deux tasses de chocolat chaud, et les lutins ont souri en le lisant.`
    : "J'ai lu chacun de tes mots dans mon grand carnet, entre deux tasses de chocolat chaud, et les lutins ont souri en les découvrant.";
  const reply = [
    greeting,
    "",
    "Ta lettre est bien arrivée au Pôle Nord, portée par la neige et le vent du Nord. Merci d'avoir pris le temps de m'écrire.",
    wishLine,
    "Ici, au village, les rennes se reposent, les chalets s'illuminent et le grand sapin brille plus fort chaque soir.",
    "Je ne peux rien promettre, car la magie de Noël garde ses secrets, mais je sais une chose : les plus beaux cadeaux sont souvent ceux que l'on offre. Un sourire, un coup de main, un moment partagé avec ceux que tu aimes.",
    "Prends soin de toi, garde ton cœur plein d'espoir et ouvre grand les yeux : la magie se cache parfois tout près.",
    "",
    "Avec toute ma tendresse,",
    "Le Père Noël",
  ].join("\n");
  return { reply };
}
