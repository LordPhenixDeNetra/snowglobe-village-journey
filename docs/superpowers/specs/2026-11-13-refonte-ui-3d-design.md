# Refonte UI/UX et 3D du village de Noël — conception

Date : 2026-11-13. Statut : en attente d'approbation.

## 1. Intention

Transformer le village actuel (cubes et cônes, panneau latéral dense) en un village de Noël
**cartoon stylisé, façon boule à neige**, avec une interface **« nuit polaire »** (bleu nuit, or,
touches d'aurore, verre dépoli). Le résultat doit :

- impressionner un jury universitaire et servir de vitrine en ligne (première impression desktop) ;
- rester confortable et lisible pour du grand public en casque VR ;
- être utilisable au pouce par des familles sur téléphone (desktop mobile et AR).

Le plan du village, le catalogue des lieux, le parcours IA, les activités, la météo, l'audio et la
navigation XR existants sont conservés : la refonte change ce que l'on voit et comment on interagit,
pas les règles métier.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs**

1. Scène 3D riche et cohérente : chalets différenciés, grand sapin, forêt, sol enneigé, lac gelé
   avec patineurs, lampadaires et guirlandes, rennes, lutins et Père Noël.
2. Interface en trois surfaces cohérentes : écran d'accueil, barre d'actions basse avec panneaux,
   puis déclinaison VR (panneaux dans la scène) et AR (overlay).
3. 72 ips sur Meta Quest 2 en VR, 60 ips sur téléphone milieu de gamme en AR.
4. Accessibilité de base : contraste 4,5:1, cibles 44 px, focus visible, `prefers-reduced-motion`,
   libellés ARIA en français.

**Non-objectifs**

- Nouveau plan de village ou nouveaux lieux dans `PLACES`.
- Mode clair : l'interface est sombre par défaut, sans bascule.
- Modèles GLB supplémentaires : toute la nouvelle géométrie est procédurale. Le traîneau GLB reste.
- Persistance (compte, sauvegarde) : hors périmètre, comme aujourd'hui.
- Physique : les personnages et animaux sont décoratifs, sans collision avec le visiteur.

**Anti-objectifs** (échec même si « ça marche »)

- Une scène qui rame sur Quest 2 ou qui chauffe un téléphone en AR.
- Une interface « IA générique » : emojis en guise d'icônes, dégradés violets, cartes blanches sur fond
  blanc. Les icônes sont Lucide ; les couleurs passent par des tokens.
- Casser un test existant ou une règle XR (hauteur des yeux, zones de marche, AR sans ciel).
- Introduire une dépendance lourde ou un asset distant sans licence.

## 3. Contraintes

| Contrainte | Conséquence |
| --- | --- |
| Projet synchronisé avec Lovable ; branche `main` toujours fonctionnelle | Quatre PR séquentielles (1, 2a, 2b, 3), chacune livrable seule, ouverte depuis `main` après la fusion de la précédente |
| `PLACES`, `safeLanding`, `viewpoint`, `sleighDestination`, `ornamentPosition`, `GIFTS` testés | Positions et rayons conservés ; les nouveaux obstacles passent par une liste testée |
| Tokens oklch dans `src/styles.css`, couleurs de scène lues via `useWeatherColors` | Toute nouvelle couleur est un token `--scene-*` ou shadcn |
| AR : miniature à 0,015–0,05, aucun ciel, sol de rayon 23 | Tout nouvel élément tient dans le rayon 23 et suit le groupe de scène |
| VR : origine à l'échelle 1 m, sol à y = 0, pas de contrôle caméra desktop en session | Les panneaux VR restent des objets de scène ; aucune caméra forcée |
| Budget Quest 2 | ≤ 150 draw calls, ≤ 200 k triangles visibles, 1 seule lumière à ombres (directionnelle), ≤ 4 lumières ponctuelles sans ombre, ≤ 3 000 particules de neige (déjà le maximum de `snowfall`) |
| Pas de secret dans le dépôt, génération IA côté serveur uniquement | Inchangé |
| Règles locales de l'utilisateur (`CLAUDE.local.md`) | Aucun commit par l'agent ; commandes Git Bash fournies avec `git commit -s`, un commit par sujet en Conventional Commits anglais, co-auteur `NetraDevLPDN` ; corps de PR dans `.git/pr-body.md` ; points reportés dans `POINTS_REPORTES.md` ; aucune mention d'outil IA dans le code, les commits ou les PR |

## 4. Approches envisagées

| Approche | Avantages | Inconvénients | Décision |
| --- | --- | --- | --- |
| **A. PR séquentielles : identité + accueil + barre basse (PR1) → décor 3D (PR2a) → personnages 3D (PR2b) → VR/AR (PR3)** | Chaque PR testable et visible seule ; les tokens posés en PR1 servent à la 3D et à la VR ; `main` reste propre pour Lovable | Quatre cycles de relecture ; l'agent attend la fusion de chaque PR dans `main` avant d'ouvrir la suivante (aucune branche empilée, aucun rebase) | **Retenue** |
| B. Deux PR : 3D puis toute l'interface | La scène arrive vite | PR interface énorme (desktop + VR + AR) ; la 3D doit anticiper des tokens non encore définis | Écartée |
| C. Une seule PR | Livraison la plus rapide | Illisible en relecture, impossible à annuler partiellement, risque pour la synchro Lovable | Écartée |

Pour les assets 3D : procédural en code (retenu) plutôt que GLB CC0 (poids, harmonisation de style)
ou mixte. Pour l'interface : accueil + barre basse (retenu) plutôt que panneau latéral en onglets ou
interface purement contextuelle, car la barre basse est la seule disposition qui fonctionne au pouce
sur 390 px, à la souris et comme modèle pour les panneaux VR.

## 5. Identité visuelle (PR1, réutilisée partout)

### 5.1 Couleurs

Tous les tokens shadcn de `:root` passent en « nuit polaire » (une seule déclinaison, sombre ; le
bloc `.dark` reprend les mêmes valeurs pour ne rien casser). Valeurs de départ, à ajuster au contraste :

| Token | Rôle | Valeur de départ |
| --- | --- | --- |
| `--background` | fond de page sous le canvas | `oklch(0.17 0.04 265)` |
| `--foreground` | texte | `oklch(0.96 0.015 230)` (neige) |
| `--card` | panneaux en verre | `oklch(0.22 0.045 265 / 0.72)` + `backdrop-blur` 16 px |
| `--primary` / `--primary-foreground` | action principale, or | `oklch(0.84 0.14 88)` / `oklch(0.2 0.04 265)` |
| `--secondary` / `--secondary-foreground` | action secondaire, aurore verte | `oklch(0.72 0.14 160)` / `oklch(0.17 0.04 265)` |
| `--accent` / `--accent-foreground` | survol, sélection | `oklch(0.3 0.06 285)` / neige |
| `--muted-foreground` | texte secondaire | `oklch(0.75 0.03 250)` (≥ 4,5:1 sur `--card`) |
| `--border` | bordure verre | `oklch(1 0 0 / 0.14)` |
| `--ring` | focus | or |
| `--destructive` | erreurs | `oklch(0.7 0.19 22)` |

Les tokens `--scene-*` existants restent ; PR2 en ajoute (bois, toit, glace, lanterne, pelage,
costume) plutôt que des hexadécimaux dans les composants.

Vérification obligatoire : texte neige et texte or sur `--card` superposée à la scène la plus claire
(ambiance jour) ≥ 4,5:1 ; sinon augmenter l'opacité de `--card`.

### 5.2 Typographie

- Titres : **Fredoka** (500–700). Corps : **Nunito** (400–700). Repli : `system-ui, sans-serif`.
- Chargement par `<link>` Google Fonts avec `preconnect` et `display=swap` dans `__root.tsx`
  (pas de nouvelle dépendance). Les panneaux VR dessinés sur canvas utilisent Fredoka si
  `document.fonts.check` répond vrai, sinon `sans-serif`, pour ne jamais bloquer le casque.
- Échelle : titre accueil 40–56 px, titre de panneau 20 px, corps 16 px / interligne 1,5,
  légendes 13 px minimum. Jamais moins de 12 px.

### 5.3 Mouvement

- Transitions UI 150–250 ms, `ease-out` ; apparition des panneaux par translation 8 px + fondu.
- Sous `prefers-reduced-motion: reduce` : pas d'animation d'accueil, pas d'orbite automatique de la
  caméra, transitions instantanées. Les animations de scène (neige, personnages) continuent, car ce
  sont le contenu, mais sans parallaxe liée au défilement.
- Une seule animation « héros » par vue (ex. le titre d'accueil), pas de `animate-bounce` multiples.

### 5.4 Icônes

Lucide uniquement (déjà installé). Tout bouton icône a `aria-label` et `title`. Pas d'emoji dans
les boutons ; les emojis existants (🎁, ✨) sont remplacés.

## 6. PR1 — Accueil et barre d'actions (desktop et mobile)

### 6.1 Écran d'accueil

Superposition plein écran sur le canvas, qui tourne déjà derrière (orbite lente automatique tant
que l'accueil est affiché, désactivée sous reduced-motion).

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│            ✦  V I L L A G E   D E   N O Ë L  ✦               │  Fredoka, or, ombre douce
│       Une promenade magique, en 3D, en VR ou en AR           │  Nunito, neige
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │ Que souhaitez-vous découvrir ?                       │   │  carte verre
│   │ ┌──────────────────────────────────────────────────┐ │   │
│   │ │ Ex. : des douceurs sucrées et des jeux…          │ │   │  textarea, 500 car.
│   │ └──────────────────────────────────────────────────┘ │   │
│   │ [ ✨ Créer mon parcours ]   [ Visiter librement → ]  │   │  or plein / contour
│   └──────────────────────────────────────────────────────┘   │
│                                                              │
│        [ 🥽 Entrer en VR ]      [ 📱 Entrer en AR ]           │  icônes Lucide, état support
│   Musique et sons démarrent sur votre geste · Projet WebXR   │  légende
└──────────────────────────────────────────────────────────────┘
```

- Ambiance par défaut au premier chargement : **Nuit polaire** (`useState<Ambience>("night")`),
  décision de l'utilisateur : l'accueil est composé sur l'aurore et les lumières chaudes. Jour et
  crépuscule restent accessibles depuis le panneau Ambiance.
- « Créer mon parcours » appelle `planTour` ; pendant le chargement le bouton affiche l'état et la
  carte reste ouverte ; en cas d'erreur, message sous le champ, près de l'erreur.
- « Visiter librement » ferme l'accueil sans parcours. Le parcours reste créable depuis la barre.
- Les boutons VR/AR gardent la logique actuelle (`useXRSessionModeSupported`, messages d'erreur).
- Sur 390 px : une colonne, boutons pleine largeur, carte à 16 px des bords, aucun défilement
  horizontal, `padding-bottom: env(safe-area-inset-bottom)`.
- Composant : `src/components/shell/WelcomeScreen.tsx`.

### 6.2 Barre d'actions basse

Visible une fois l'accueil fermé, hors session XR. Cinq entrées maximum, icône + libellé court.

```
desktop (≥ 768 px)                                 mobile (< 768 px)
┌─ panneau flottant (max 360 px) ─┐                ┌─ Drawer (vaul) depuis le bas ─┐
│ Activités                    ✕ │                │ ━━                            │
│ [Poste] [Cadeaux] [Sapin]       │                │ Activités                     │
│ …contenu de l'onglet…           │                │ …                             │
└─────────────────────────────────┘                └───────────────────────────────┘
┌──────────────────────────────────────────────┐   ┌──────────────────────────────┐
│ 🧭 Parcours  🎁 Activités  🌙 Ambiance  🎵 Musique  🥽 Immersion │   │ 5 icônes, libellés 12 px │
└──────────────────────────────────────────────┘   └──────────────────────────────┘
```

| Entrée | Contenu du panneau | Source actuelle |
| --- | --- | --- |
| Parcours | Formulaire du souhait, ou étape courante (titre, n/N, note), Précédent/Suivant, « Nouveau parcours » | `Village.tsx` |
| Activités | Onglets Poste / Cadeaux / Sapin (shadcn `Tabs`), contenu inchangé (lettre-parchemin, chasse, décoration) | `ActivityControls.tsx` |
| Ambiance | Jour / Crépuscule / Nuit polaire (`ToggleGroup`), curseur Neige (`Slider`) | `WeatherControls.tsx` |
| Musique | Lecture/pause, volume (`Slider`), état d'erreur | `ChristmasMusic.tsx` |
| Immersion | Entrer en VR / AR, état de support, erreurs XR | `Village.tsx` |

- Un seul panneau ouvert à la fois ; `Escape` et clic hors panneau le ferment ; l'entrée active
  est `aria-pressed`. Cibles ≥ 44 × 44 px, 8 px d'écart.
- Quand un parcours est actif, une **puce de parcours** flotte en haut au centre :
  `◀  2/4 · La Chocolaterie  ▶`, cliquable pour ouvrir le panneau Parcours. Quand la chasse est
  active hors panneau, un compteur `🎁 3/5` (icône Lucide `Gift`) s'affiche à côté.
- Marque discrète en haut à gauche (« Village de Noël », Fredoka 18 px), qui remplace le grand H1.
- Composants : `src/components/shell/ActionBar.tsx`, `TourChip.tsx`, `Panel.tsx` (choisit Drawer ou
  carte flottante selon `useIsMobile`, déjà présent). `Village.tsx` garde l'état et la scène ; les
  blocs JSX d'interface migrent dans `shell/`. Les contrôles de `ChristmasMusic` deviennent un
  contenu de panneau, mais l'élément `<audio>` et le mixeur restent montés en permanence dans
  `Village.tsx` : fermer le panneau ne coupe pas la musique.
- Le rappel « Réponse imaginaire générée par IA · ne partagez pas d'adresse » reste affiché dans
  chaque surface où l'on écrit au Père Noël (desktop, AR, panneau VR).

### 6.3 Vérifications PR1

- Tests : `app-routing.test.tsx` et les tests purs existants passent ; un test RTL
  `shell.test.tsx` : l'accueil s'affiche, « Visiter librement » le ferme et la barre apparaît ;
  le panneau Parcours affiche l'erreur renvoyée par `planTour` (mock).
- Captures à 1440 px, 768 px et 390 px : accueil, barre avec chaque panneau ouvert, puce de
  parcours. Contraste mesuré sur les captures « jour ».
- Outil de capture : Playwright (Python 3.14 + paquet `playwright` déjà installés sur la machine,
  Edge disponible comme navigateur) via un script dans le dossier de travail temporaire de
  l'agent ; les captures sont montrées à l'utilisateur et **ne sont pas committées**.
- `npm run lint`, `npm run build`.

## 7. PR2a et PR2b — Scène 3D cartoon

Découpage : **PR2a (décor)** livre les chalets, le grand sapin, la forêt, le sol, le lac sans
patineurs, les lampadaires, les guirlandes, les bonshommes, `village-props.ts` avec les obstacles
et la sonde `__villageStats`. **PR2b (personnages)** livre `gait.ts`, le bipède et le quadrupède
partagés, les rennes et leur enclos, les lutins, le Père Noël et les patineurs. PR2b part de `main`
après la fusion de PR2a.

### 7.1 Direction artistique

- **Formes** : boîtes et cônes biseautés (arêtes arrondies), proportions trapues (toits larges,
  cheminées épaisses, fenêtres surdimensionnées), congères arrondies au pied des objets.
- **Matériaux** : `MeshStandardMaterial` mats (roughness 0,8–1), couleurs locales franches, pas de
  contours. `MeshBasicMaterial` pour tout ce qui est émissif pur (ampoules, fenêtres la nuit,
  décalques de lumière) afin d'éviter le coût d'éclairage.
- **Neige** : chaque toit, branche et bord de lac reçoit une calotte de neige distincte (géométrie
  séparée, pas une recoloration), conformément au profil glace/neige : la glace est lisse et
  légèrement bleutée, la neige est mate et granuleuse.
- **Lumière** : « la nuit est faite de pools, pas d'un jour assombri ». Lanternes et fenêtres
  chaudes, lune froide faible. Le jour et le crépuscule gardent les réglages de `WEATHER_LIGHT`
  ajustés au nouveau rendu.
- **Échelle** : 1 unité = 1 m. Porte 2 m, fenêtre 0,9 m, lampadaire 2,8 m, renne 1,5 m au garrot,
  lutin 1,1 m, Père Noël 1,9 m. Un seul repère d'échelle répété (les portes) dans chaque vue.

### 7.2 Inventaire

| Élément | Construction | Budget | Règles |
| --- | --- | --- | --- |
| **8 chalets** (`Chalet.tsx`) | Composant paramétré `{ placeId, seed }` : 3 silhouettes (pignon simple, A-frame pentu, deux niveaux avec balcon), couleur de façade tirée de `PLACES` (rouge, vert, doré, bleu, prune, cuivré…), toit enneigé, cheminée + `ChimneySmoke`, 2–4 fenêtres émissives, porte avec couronne, lanterne de porte, enseigne avec icône du lieu dessinée sur canvas, congère | ≤ 600 triangles chacun, matériaux partagés | Emprise ≤ 2,9 × 2,2 m centrée sur `place.pos` : les coins restent dans le rayon de collision 1,8 m |
| **Grand sapin** | 5 étages de cônes arrondis, pointes enneigées, étoile dorée, tronc épais, socle de cadeaux décoratifs ; les 60 lumières deviennent un `InstancedMesh` avec `setColorAt` et scintillement par mise à jour des couleurs (≤ 30 Hz) | 1 draw call pour les lumières | Silhouette compatible avec `ornamentPosition` (rayon 2,34 m à y = 1,4) et `TreeDecorations` inchangé |
| **Forêt** | 80 conifères en 2 `InstancedMesh` (troncs, feuillage étagé) + 1 pour les calottes de neige, graine fixe | 3 draw calls | Rayon 13–21 m, inchangé ; en AR, seuls ceux dans le rayon 23 |
| **Sol** | Disque à relief léger (bruit sur les sommets, amplitude 0,15 m, nul dans le rayon 12 pour la marche VR), teinte neige, anneau de chemin tassé (teinte plus sombre) reliant les chalets au sapin, paillettes : `Points` ≤ 600 qui clignotent | 3 draw calls | y = 0 dans le rayon 12 ; en AR rayon 23 |
| **Lac gelé** | Ellipse 4,4 × 3 m, grand axe tangent à l'anneau, centre proposé `(-1.7, 0.01, -4.2)` (entre le Chalet des Contes et le Marché), glace lisse `roughness 0.15`, `envMapIntensity` léger, bord de neige, 2 patineurs | ≤ 400 triangles + 2 bipèdes | Ne contient aucun point renvoyé par `viewpoint` (ils sont à r = 6 aux angles des chalets, et à `[x, 0, z ± 3]` pour les bonshommes), ne touche aucune emprise de chalet ni le rayon 2,8 du sapin ; plat, donc la marche VR le traverse. Test : `village-props.test.ts` vérifie ces distances |
| **8 lampadaires** (`LampPost.tsx`) | Fût effilé, tête vitrée émissive, calotte de neige, décalque de pool lumineux au sol (disque transparent dégradé) ; en desktop, 3 `PointLight` sans ombre sur les lampadaires les plus proches de la vue par défaut ; aucun en VR/AR | 1 `InstancedMesh` pour les fûts, 1 pour les vitres | Positions à r = 6,5 m, aux angles intermédiaires entre chalets ; ajoutés à `OBSTACLES` (rayon 0,35) pour `safeLanding` |
| **Guirlandes** | 8 câbles (`Line` ou tube fin) entre chalets voisins, caténaire, + 1 `InstancedMesh` de ~112 ampoules colorées avec scintillement | 2 draw calls | Hauteur ≥ 2,6 m pour passer au-dessus du visiteur VR |
| **3 rennes** (`Reindeer.tsx`) | Quadrupède procédural à pièces rigides (corps tonneau, cou, tête, bois, 4 pattes à 2 segments, queue) adapté du gabarit « quadruped walker » ; 1 trotte sur une boucle dans un enclos, 2 broutent (balancement de tête) ; un nez rouge émissif | ≤ 900 triangles chacun | Enclos avec barrière, centre `(10.3, 0, -10.3)` rayon 2,5 (r ≈ 14,5, dans l'axe de l'Écurie, hors du rayon 12 de marche) ; la forêt instanciée exclut les arbres tombant dans l'enclos ; `gait.ts` pur et testé |
| **3 lutins + Père Noël** (`Villager.tsx`) | Bipède procédural partagé (torse, tête, chapeau, bras et jambes à 2 segments), paramètres : échelle, couleurs, accessoire ; 1 lutin marche en boucle entre l'atelier et le sapin avec un cadeau, 2 lutins martèlent/saluent devant l'atelier ; le Père Noël se tient près de la poste et salue quand l'activité « lettre » est active | ≤ 700 triangles chacun | Boucle de marche à l'écart des points de vue (`viewpoint`) ; personnages sans collision |
| **Patineurs** | Même bipède, mode « glisse » (pas de cycle de pas, inclinaison + balancement lent) sur un « 8 » dans le lac | — | — |
| **Bonshommes** | Boules plus rondes, écharpe, chapeau, boutons, bras-brindilles, sourire en pierres | ≤ 400 triangles | Positions inchangées |
| Existant conservé | `SantaSleigh`, `SleighStars`, `Aurora`, `Snow`, `TreeDecorations`, `VillageActivities` (cadeaux, feux d'artifice) | — | Cadeaux : vérifier qu'ils restent visibles sous les nouveaux arbres |

Nouveau module pur `src/lib/village-props.ts` : positions des lampadaires, de l'enclos, du lac,
des boucles de marche, et `OBSTACLES`. `safeLanding` ajoute le test des obstacles ; un test vérifie
que chaque `viewpoint` reste sûr et qu'un point sur un lampadaire est refusé.

Nouveau module pur `src/lib/gait.ts` : phase de marche avancée par la distance parcourue (pas par
le temps), angles des pattes en paires diagonales (quadrupède) ou en opposition bras/jambe (bipède),
suivi de route polyligne avec vitesse de lacet bornée. Test : la phase est déterministe, les jambes
alternent, la vitesse 0 ne fait pas avancer la phase.

### 7.3 Performance et sondes

- Sonde de développement `window.__villageStats()` → `{ calls, triangles, geometries, textures }`
  lus sur `renderer.info`, comme les sondes existantes (absente en production).
- Objectif mesuré en desktop : ≤ 120 draw calls et ≤ 180 k triangles à la vue par défaut ; la marge
  restante sert au Quest. Si dépassé : fusionner les géométries statiques d'un chalet en une seule
  (`BufferGeometryUtils.mergeGeometries`, déjà dans three) avant toute autre optimisation.
- Toutes les animations hors React (`useFrame` + refs, `InstancedMesh`), `dt` borné à 0,05 s.
- Ombres : uniquement la directionnelle existante ; les personnages et lampadaires ne projettent
  pas d'ombre en VR/AR (`castShadow` conditionnel au mode).

### 7.4 Vérifications PR2

- Tests existants + `gait.test.ts` + obstacles dans `xr-navigation.test.ts`.
- Captures desktop à la vue par défaut, `__villageActivities.overview()`, gros plan sur un chalet,
  le lac, l'enclos, les trois ambiances ; captures 390 px ; valeurs de `__villageStats()` notées
  dans la PR.
- Vérifier en desktop que `__sleigh.sim(4)` arrive toujours devant chaque lieu et que
  `__villageActivities.viewGift(i)` montre chaque cadeau dégagé.

## 8. PR3 — VR et AR

### 8.1 VR : panneaux dans la scène

- `WorldButton` devient `WorldPanel` + `WorldButton` : un panneau en « verre » (plan arrondi
  dessiné sur canvas avec la palette : fond nuit 72 %, bordure claire, titre Fredoka si disponible)
  qui regroupe des boutons. Les boutons ont un état survolé (`onPointerOver` : éclaircissement et
  échelle 1,05) et pressé (impulsion haptique déjà présente).
- Hiérarchie (au lieu des 12+ boutons actuels affichés en même temps) :
  1. **Ligne principale** : `◀ Précédent` · `2/4 · La Chocolaterie` (répète le point de vue) · `Suivant ▶`.
  2. **Ligne secondaire** : `Écouter le conteur` / `Couper`, `Répéter la voix`, `Point de vue suivant`.
  3. **« Plus… »** (bascule) : rotation fluide/à-coups, ambiance, neige, activités (Poste, Cadeaux,
     Sapin, avec le clavier-monde et le parchemin existants), `Quitter la VR`.
- Le panneau suit la tête à 1,4 m comme aujourd'hui ; taille de texte ≥ 48 px canvas pour 0,21 m de
  haut, soit ≈ 1,2° d'angle : lisible sur Quest 2.
- Aucune modification de `xr-navigation.ts`, de la marche, de la téléportation ni des boutons A/B.

### 8.2 AR : overlay et repli

- L'overlay DOM réutilise `ActionBar` et `Panel` en mode mobile (Drawer bas avec poignée, zones
  sûres), avec cinq entrées : Parcours, Activités, Ambiance, Conteur, Maquette (taille, orientation,
  repositionner). « Quitter l'AR » est un bouton à part, en haut à droite de l'overlay.
- `XRDomOverlay` n'affiche que son propre sous-arbre : le Drawer est rendu sans portail
  (prop `container` ou rendu en ligne) pour rester visible dans l'overlay.
- Avant la pose : un bandeau d'état (« Recherche d'une surface… » / « Surface détectée ») et un
  grand bouton or « Poser le village » ; le réticule devient un anneau doux avec un point central
  pulsé (`MeshBasicMaterial`).
- Sans overlay DOM : les mêmes groupes en `WorldPanel`.
- Règles conservées : aucun ciel, `beforexrselect` bloqué sur l'overlay, ancres optionnelles,
  narration française et ducking audio inchangés.

### 8.3 Vérifications PR3

- Tests existants (dont `ar-audio-lifecycle`) ; un test pur pour la hiérarchie des panneaux VR
  n'est pas nécessaire si la logique reste dans le JSX ; si une fonction de disposition apparaît
  (positions des boutons selon le nombre), elle est testée.
- Captures de l'overlay AR à 390 px via l'émulateur XR du navigateur si disponible, sinon capture
  du composant en mode mobile hors session.
- `XR_CHECKS.md` mis à jour : lisibilité des panneaux, bascule « Plus… », survol au rayon, overlay AR.

## 9. Ce qui est laissé au constructeur

- Valeurs finales des tokens (dans les bornes de contraste), rayons de biseau, graines.
- Paramètres de géométrie des chalets, rennes et bipèdes, tant que l'inventaire, les emprises et
  les budgets sont respectés.
- Position exacte du lac, de l'enclos et des boucles de marche, dans les contraintes ci-dessus.
- Animation d'ouverture des panneaux, apparence de la poignée du Drawer.
- Découpage en fichiers à l'intérieur de `src/components/shell/` et `src/components/scene/`, en
  gardant le moins de fichiers possible et `Village.tsx` comme propriétaire de l'état.

## 10. Décisions prises par l'agent (à contester si besoin)

1. Thème sombre unique, pas de mode clair.
2. Google Fonts par `<link>` plutôt qu'un paquet de polices ; repli système ; jamais bloquant en VR.
3. Lampadaires : lumière « peinte » (émissif + décalque au sol) partout, 3 vraies `PointLight` en
   desktop seulement.
4. Lac placé à l'intérieur de l'anneau, traversable à pied en VR ; personnages sans collision.
5. Les lampadaires deviennent des obstacles de marche (liste testée) ; pas les personnages.
6. La musique rejoint la barre d'actions ; plus de widget flottant en bas à gauche.
7. Le grand H1 disparaît au profit de l'accueil et d'une marque discrète.
