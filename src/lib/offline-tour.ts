import type { TourResult } from "./tour.functions";

// Offline stand-in for the AI guide (static hosting has no server): the wish is matched against a few
// themed tours written in advance. Ids come from village-places, like the AI guide's.
type Theme = { title: string; keywords: string[]; stops: [string, string][] };

const THEMES: Theme[] = [
  {
    title: "La tournée des gourmands",
    keywords: [
      "douceur",
      "sucre",
      "chocolat",
      "gateau",
      "biscuit",
      "gourmand",
      "manger",
      "pain",
      "buche",
      "boisson",
    ],
    stops: [
      ["chocolaterie", "Un chocolat chaud pour se réchauffer les mains et le cœur."],
      ["boulangerie", "Bûches et biscuits de Noël tout juste sortis du four."],
      ["grand-sapin", "Une pause gourmande au pied du sapin illuminé."],
      ["bonhomme-est", "Une photo souvenir, les joues encore pleines de miettes."],
    ],
  },
  {
    title: "Le village des enfants",
    keywords: [
      "enfant",
      "jeu",
      "jouet",
      "jouer",
      "famille",
      "lutin",
      "petit",
      "bonhomme",
      "photo",
      "neige",
    ],
    stops: [
      ["atelier-jouets", "Les lutins fabriquent les jouets sous vos yeux."],
      ["bonhomme-est", "Le bonhomme de neige joyeux attend votre plus belle grimace."],
      ["ecurie-rennes", "Les rennes du traîneau se reposent avant la grande nuit."],
      ["bonhomme-ouest", "Une clairière parfaite pour une bataille de boules de neige."],
    ],
  },
  {
    title: "Contes et lettres au coin du feu",
    keywords: [
      "conte",
      "histoire",
      "lettre",
      "lire",
      "ecrire",
      "feu",
      "pere noel",
      "calme",
      "legende",
      "poste",
    ],
    stops: [
      ["chalet-contes", "Des histoires au coin du feu, à écouter emmitouflé."],
      ["poste-pere-noel", "Le moment d'écrire votre lettre au Père Noël."],
      ["grand-sapin", "Une dernière légende sous l'étoile dorée du sapin."],
    ],
  },
  {
    title: "Artisans et décorations",
    keywords: [
      "artisan",
      "decoration",
      "boule",
      "bougie",
      "cadeau",
      "marche",
      "acheter",
      "fait main",
      "ornement",
      "creation",
    ],
    stops: [
      ["marche-artisans", "Des créations faites main, uniques comme chaque visiteur."],
      ["boutique-decorations", "Boules, bougies et ornements pour briller à la maison."],
      ["atelier-jouets", "Les lutins montrent les secrets de leurs plus beaux jouets."],
      ["grand-sapin", "Admirez comment tout ce savoir-faire habille le grand sapin."],
    ],
  },
  {
    title: "Rennes et forêt enneigée",
    keywords: ["renne", "traineau", "foret", "nature", "animal", "promenade", "balade", "calme"],
    stops: [
      ["ecurie-rennes", "Les rennes se reposent avant la tournée du Père Noël."],
      ["bonhomme-ouest", "La clairière enneigée, au bord de la forêt."],
      ["grand-sapin", "Retour au cœur du village, sous les guirlandes."],
    ],
  },
];

const GRAND_TOUR: Theme = {
  title: "Le grand tour du village",
  keywords: [],
  stops: [
    ["grand-sapin", "Tout commence au pied du grand sapin illuminé."],
    ["chocolaterie", "Un chocolat chaud pour prendre des forces."],
    ["atelier-jouets", "Les lutins sont à l'ouvrage pour la grande nuit."],
    ["poste-pere-noel", "Une lettre au Père Noël, avant qu'il ne parte."],
    ["chalet-contes", "Une histoire au coin du feu pour finir en douceur."],
  ],
};

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function planTourOffline(wish: string): TourResult {
  const text = fold(
    String(wish ?? "")
      .trim()
      .slice(0, 500),
  );
  if (!text) return { error: "Décrivez ce que vous souhaitez découvrir." };
  let best = GRAND_TOUR,
    bestScore = 0;
  for (const theme of THEMES) {
    const score = theme.keywords.filter((keyword) => text.includes(keyword)).length;
    if (score > bestScore) {
      best = theme;
      bestScore = score;
    }
  }
  return { title: best.title, stops: best.stops.map(([id, note]) => ({ id, note })) };
}
