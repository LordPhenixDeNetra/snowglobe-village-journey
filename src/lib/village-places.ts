export type Place = { id: string; name: string; desc: string; pos: [number, number, number] };

const ring = (i: number, r = 9): [number, number, number] => {
  const a = (i / 8) * Math.PI * 2;
  return [Math.cos(a) * r, 1, Math.sin(a) * r];
};

export const PLACES: Place[] = [
  { id: "grand-sapin", name: "Le Grand Sapin", desc: "Sapin géant illuminé de guirlandes et coiffé d'une étoile dorée.", pos: [0, 3, 0] },
  { id: "chocolaterie", name: "La Chocolaterie", desc: "Maison rouge où l'on sert chocolat chaud et pain d'épices.", pos: ring(0) },
  { id: "atelier-jouets", name: "L'Atelier des Jouets", desc: "Maison verte où les lutins fabriquent les jouets.", pos: ring(1) },
  { id: "boulangerie", name: "La Boulangerie", desc: "Maison dorée aux bûches et biscuits de Noël.", pos: ring(2) },
  { id: "poste-pere-noel", name: "La Poste du Père Noël", desc: "Maison bleue où l'on écrit et poste sa lettre au Père Noël.", pos: ring(3) },
  { id: "boutique-decorations", name: "La Boutique de Décorations", desc: "Maison prune pleine de boules, bougies et ornements.", pos: ring(4) },
  { id: "chalet-contes", name: "Le Chalet des Contes", desc: "Maison cuivrée où l'on écoute des histoires au coin du feu.", pos: ring(5) },
  { id: "marche-artisans", name: "Le Marché des Artisans", desc: "Maison rouge aux créations faites main.", pos: ring(6) },
  { id: "ecurie-rennes", name: "L'Écurie des Rennes", desc: "Maison verte où se reposent les rennes du traîneau.", pos: ring(7) },
  { id: "bonhomme-est", name: "Le Bonhomme de Neige joyeux", desc: "Coin photo avec un bonhomme de neige.", pos: [4, 1, 3] },
  { id: "bonhomme-ouest", name: "La Clairière enneigée", desc: "Bonhomme de neige près de la forêt, idéal pour une bataille de boules.", pos: [-4.5, 1, -2.5] },
];
