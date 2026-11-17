# PR2a — Décor 3D cartoon : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les cubes et cônes du village par un décor cartoon stylisé (chalets différenciés, grand sapin, forêt instanciée, sol en relief, lac gelé, lampadaires, guirlandes, bonshommes) sans toucher au plan du village, aux règles XR ni aux activités, et sous le budget Quest 2.

**Architecture:** Les positions et règles de placement deviennent un module pur `src/lib/village-props.ts` (testé) ; les obstacles qu'il déclare entrent dans `safeLanding`. Chaque élément de décor est un composant R3F dans `src/components/scene/`, qui lit ses couleurs via `useWeatherColors` (tokens `--scene-*`) et fusionne ses pièces par matériau pour tenir en quelques draw calls. `Village.tsx` ne garde que la composition de la scène.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/drei 10 (`Instances`, `Sparkles`), three 0.187 (`RoundedBoxGeometry`, `BufferGeometryUtils.mergeGeometries`), Vitest, Playwright (captures et sonde `__villageStats`).

**Spec:** `docs/superpowers/specs/2026-11-13-refonte-ui-3d-design.md`, section 7 (PR2a = décor ; les personnages, `gait.ts`, les patineurs et l'enclos sont en PR2b).

## Global Constraints

- Aucune nouvelle dépendance ; aucun asset distant ; géométrie procédurale uniquement.
- 1 unité = 1 m. `PLACES`, `GIFTS`, `safeLanding` (rayon 2,8–12, collisions 1,8 m / 1 m), `viewpoint`, `sleighDestination`, `ornamentPosition` conservés ; les tests existants passent sans modification de leurs attentes.
- Budget Quest 2 : ≤ 150 draw calls et ≤ 200 k triangles visibles ; objectif mesuré en desktop à la vue par défaut ≤ 120 draw calls et ≤ 180 k triangles (`__villageStats()`). Une seule lumière à ombres (la directionnelle existante) ; ≤ 4 `PointLight` sans ombre ; 3 000 particules de neige maximum (déjà borné).
- Les nouveaux objets ne projettent d'ombre qu'en desktop (`castShadow={shadows}` avec `shadows = mode === "desktop"`).
- AR : tout élément tient dans le rayon 23 ; aucun ciel ajouté. VR : sol à y = 0 dans le rayon 12 (la marche), relief uniquement au-delà.
- Couleurs : tokens `--scene-*` en oklch dans `src/styles.css`, lus par `useWeatherColors` ; aucun hexadécimal dans les composants.
- Animations hors React (`useFrame` + refs, `InstancedMesh`), `dt` borné à 0,05 s ; les couleurs d'instances se mettent à jour au plus à 30 Hz.
- Emprise d'un chalet ≤ 2,9 × 2,2 m centrée sur `place.pos` ; lac et lampadaires hors de tout point de `viewpoint` et de `sleighDestination`.
- Rien n'est committé par l'agent (règles locales) ; commandes git dans le compte rendu final ; aucune mention d'outil IA dans les fichiers.
- Lovable : ne pas toucher `drizzle/`, `supabase/`, `src/generated/`, `src/routeTree.gen.ts`.

## Review Focus

1. Un cadeau de la chasse caché par le décor (tronc de la forêt, lac, lampadaire) : le visiteur ne peut jamais finir la chasse — test de distance dans la tâche 1.
2. Le traîneau se gare à r = 6,5 devant chaque chalet ; un lampadaire sur sa place le traverse — test de distance ≥ 1,5 m aux `sleighDestination` dans la tâche 1.
3. Marche VR : un lampadaire sans collision laisse le visiteur passer à travers — test `safeLanding` et `walkOnGround` dans la tâche 1.
4. Boules du sapin (`ornamentPosition`) flottant hors de la nouvelle silhouette — test `treeRadiusAt` dans la tâche 1.
5. AR : un objet au-delà du rayon 23 sort de la miniature — test `forestPlacements` ≤ 21 m dans la tâche 1.

---

### Task 1 : Tokens, placements purs et obstacles de marche

**Files:**
- Modify: `src/styles.css` (bloc `:root`, après `--scene-aurora-rose`)
- Modify: `src/components/VillageWeather.tsx:11` (liste des noms lus par `useWeatherColors`)
- Create: `src/lib/village-props.ts`
- Modify: `src/lib/xr-navigation.ts:59-64` (`safeLanding`)
- Test: `src/test/village-props.test.ts`, `src/test/xr-navigation.test.ts` (ajout)

**Interfaces:**
- Produces (tokens) : `--scene-plum`, `--scene-copper`, `--scene-wood`, `--scene-bark`, `--scene-needle`, `--scene-needle-dark`, `--scene-ice`, `--scene-lantern`, `--scene-path`, `--scene-stone`, `--scene-scarf` ; `useWeatherColors()` les expose sous `colors["plum"]`, etc.
- Produces (`village-props.ts`) :
  ```ts
  export type XZ = [number, number];
  export type FacadeColor = "red" | "green" | "gold" | "blue" | "plum" | "copper";
  export type ChaletVariant = "gable" | "aframe" | "storey";
  export const CHALETS: { id: string; variant: ChaletVariant; facade: FacadeColor; seed: number }[]; // 8 entrées, un par lieu de l'anneau, dans l'ordre de PLACES ; couleur = celle citée dans place.desc ; variantes gable/aframe/storey en rotation
  export const LAMP_POSTS: XZ[];              // 8, à r = 6,5 aux angles (i + 0,5) / 8 · 2π
  export const OBSTACLES: { x: number; z: number; r: number }[]; // = LAMP_POSTS avec r = 0,35
  export const LAKE = { center: [-1.7, -4.2] as XZ, rx: 2.2, rz: 1.5, rotation: number }; // grand axe tangent à l'anneau
  export const PADDOCK = { center: [10.3, -10.3] as XZ, r: 2.5 };      // réservé à PR2b ; la forêt l'évite déjà
  export const TREE_TIERS: { y: number; radius: number; height: number }[]; // 5 étages du grand sapin
  export function treeRadiusAt(y: number): number;          // rayon de la silhouette (interpolation entre étages)
  export function insideLake(x: number, z: number): boolean;
  export function forestPlacements(seed?: number): { x: number; z: number; scale: number; rotation: number }[]; // 80 arbres, r 13–21, hors PADDOCK, + les 2 petits sapins fixes [-11.3,-3] et [2.5,-11.3] (scale 1.4) en tête
  export function garlandSpans(): { from: XZ; to: XZ }[];   // 8 paires de chalets voisins (ancrage à r = 8.2, hauteur fixée par le composant)
  export function lampPoolOpacity(ambience: Ambience): number; // day 0, dusk 0.45, night 0.9
  export function seeded(seed: number): () => number;       // mulberry32 déterministe (remplace rand() de Village.tsx)
  ```
- `safeLanding(x, z)` refuse aussi tout point à moins de `r` d'un `OBSTACLE`.

- [ ] **Step 1 : Écrire les tests** (`src/test/village-props.test.ts`)
  ```ts
  import { PLACES } from "@/lib/village-places";
  import { GIFTS } from "@/lib/village-activities";
  import { sleighDestination } from "@/lib/sleigh-motion";
  import { viewpoint } from "@/lib/xr-navigation";
  import { CHALETS, LAMP_POSTS, OBSTACLES, LAKE, PADDOCK, TREE_TIERS, treeRadiusAt, insideLake, forestPlacements, garlandSpans, lampPoolOpacity, seeded } from "@/lib/village-props";
  const d = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
  it("un chalet par lieu de l'anneau, couleur tirée de la description", () => {
    expect(CHALETS.map(c => c.id)).toEqual(PLACES.filter(p => p.id !== "grand-sapin" && !p.id.startsWith("bonhomme")).map(p => p.id));
    expect(CHALETS.find(c => c.id === "poste-pere-noel")?.facade).toBe("blue");
    expect(new Set(CHALETS.map(c => c.variant)).size).toBe(3);
  });
  it("les lampadaires sont entre les chalets, hors des points de vue et de la place du traîneau", () => {
    expect(LAMP_POSTS).toHaveLength(8);
    for (const post of LAMP_POSTS) {
      expect(Math.hypot(...post)).toBeCloseTo(6.5, 5);
      for (const place of PLACES) {
        expect(d(post, [place.pos[0], place.pos[2]])).toBeGreaterThan(1.8);
        const [vx, , vz] = viewpoint(place); expect(d(post, [vx, vz])).toBeGreaterThan(0.6);
        const sleigh = sleighDestination(place.id)!; expect(d(post, [sleigh[0], sleigh[2]])).toBeGreaterThan(1.5);
      }
      for (const gift of GIFTS) expect(d(post, [gift.pos[0], gift.pos[2]])).toBeGreaterThan(1);
    }
    expect(OBSTACLES.every(o => o.r === 0.35)).toBe(true);
  });
  it("le lac ne contient ni point de vue, ni cadeau, ni emprise de chalet, ni le pied du sapin", () => {
    for (const place of PLACES) { const [vx, , vz] = viewpoint(place); expect(insideLake(vx, vz)).toBe(false); expect(d(LAKE.center, [place.pos[0], place.pos[2]])).toBeGreaterThan(place.id === "grand-sapin" ? 2.8 + 1.5 : 1.45 + 2.2); }
    for (const gift of GIFTS) expect(insideLake(gift.pos[0], gift.pos[2])).toBe(false);
    expect(insideLake(LAKE.center[0], LAKE.center[1])).toBe(true);
  });
  it("la silhouette du sapin porte les boules de ornamentPosition", () => {
    expect(TREE_TIERS).toHaveLength(5);
    expect(treeRadiusAt(1.4)).toBeCloseTo(2.34, 0);
    expect(treeRadiusAt(4.19)).toBeCloseTo(0.86, 0);
    expect(treeRadiusAt(6.4)).toBeLessThan(0.3);
  });
  it("la forêt est déterministe, dans la couronne 13–21 m, hors de l'enclos et loin des cadeaux", () => {
    const trees = forestPlacements();
    expect(trees).toHaveLength(82);
    expect(trees[0]).toMatchObject({ x: -11.3, z: -3, scale: 1.4 });
    expect(forestPlacements()).toEqual(trees);
    for (const t of trees.slice(2)) { const r = Math.hypot(t.x, t.z); expect(r).toBeGreaterThanOrEqual(13); expect(r).toBeLessThanOrEqual(21); expect(d([t.x, t.z], PADDOCK.center)).toBeGreaterThan(PADDOCK.r); }
    for (const t of trees.slice(2)) for (const gift of GIFTS) expect(d([t.x, t.z], [gift.pos[0], gift.pos[2]])).toBeGreaterThan(0.9);
  });
  it("huit guirlandes entre chalets voisins, opacité des halos par ambiance, graine stable", () => {
    expect(garlandSpans()).toHaveLength(8);
    expect(garlandSpans()[0]!.from).not.toEqual(garlandSpans()[0]!.to);
    expect(lampPoolOpacity("day")).toBe(0); expect(lampPoolOpacity("night")).toBe(0.9);
    expect(seeded(7)()).toBe(seeded(7)());
  });
  ```
  Et dans `xr-navigation.test.ts` :
  ```ts
  it("refuse les lampadaires et arrête la marche devant", () => {
    const [x, z] = LAMP_POSTS[0]!;
    expect(safeLanding(x, z)).toBe(false);
    expect(safeLanding(x + 0.3, z)).toBe(false);
    expect(safeLanding(x + 0.6, z)).toBe(true);
    const start: [number, number, number] = [x + 0.6, 0, z];
    expect(walkOnGround(start, { x: -1.2, z: 0 }, 0.05)).toEqual(start);
  });
  ```
- [ ] **Step 2 : Lancer** `npx vitest run src/test/village-props.test.ts src/test/xr-navigation.test.ts` → Expected : FAIL (module `village-props` introuvable ; `safeLanding` accepte le lampadaire).
- [ ] **Step 3 : Ajouter les tokens** dans `:root` (valeurs de départ) : plum `oklch(0.5 0.12 330)`, copper `oklch(0.6 0.13 50)`, wood `oklch(0.42 0.06 55)`, bark `oklch(0.36 0.05 50)`, needle `oklch(0.5 0.11 155)`, needle-dark `oklch(0.42 0.1 160)`, ice `oklch(0.9 0.04 225)`, lantern `oklch(0.9 0.13 85)`, path `oklch(0.9 0.015 235)`, stone `oklch(0.7 0.02 250)`, scarf `oklch(0.62 0.2 25)` ; étendre la liste de `useWeatherColors`.
- [ ] **Step 4 : Implémenter `village-props.ts`** avec les signatures ci-dessus. `treeRadiusAt` interpole linéairement entre les étages (`TREE_TIERS` : y = 1.0/2.2/3.4/4.6/5.7, rayons 2.6/2.05/1.45/0.95/0.55, hauteurs 1.6) et vaut 0 au-dessus de 6.4. `forestPlacements` tire les 80 positions avec `seeded(11)` et rejette celles dans le PADDOCK ou à < 0,9 m d'un cadeau (retirage).
- [ ] **Step 5 : Étendre `safeLanding`** : après le test des lieux, `OBSTACLES.every(o => Math.hypot(x - o.x, z - o.z) > o.r)`. Importer `OBSTACLES` depuis `village-props` (pas d'import circulaire : `village-props` n'importe que `village-places`, `village-activities` et `village-weather`).
- [ ] **Step 6 : Lancer** `npx vitest run` → Expected : tous PASS (le test existant « keeps every quick viewpoint on safe ground » reste vert : les points de vue sont à ≥ 0,6 m des lampadaires).
- [ ] **Step 7 : Prêt à committer** — `feat(scene): village prop placements, scene tokens and lamp-post obstacles`.

### Task 2 : Chalets

**Files:**
- Create: `src/components/scene/geometry.ts`
- Create: `src/components/scene/Chalet.tsx`
- Modify: `src/components/Village.tsx` (supprimer `House` lignes 94–122 ; `houses` memo lignes 246–252 ; rendu ligne 281)

**Interfaces:**
- Produces (`geometry.ts`) :
  ```ts
  export type Part = { geometry: THREE.BufferGeometry; position?: [number, number, number]; rotation?: [number, number, number]; scale?: number | [number, number, number] };
  export function merged(parts: Part[]): THREE.BufferGeometry;   // applique les transformations puis BufferGeometryUtils.mergeGeometries ; dispose les sources
  export function box(w: number, h: number, d: number, radius = 0.05): THREE.BufferGeometry; // RoundedBoxGeometry(w, h, d, 2, radius)
  export function useMerged(build: () => Part[], deps: unknown[]): THREE.BufferGeometry; // useMemo + dispose au démontage
  export function useLabelTexture(text: string, options?: { width?: number; height?: number; font?: string }): THREE.CanvasTexture | undefined; // texte centré, fond `--parchment`, encre `--parchment-ink`, police Fredoka si `document.fonts.check` sinon sans-serif
  ```
- Produces (`Chalet.tsx`) : `export default function Chalet({ place, variant, facade, seed, rotation, shadows }: { place: Place; variant: ChaletVariant; facade: FacadeColor; seed: number; rotation: number; shadows: boolean }): JSX.Element` — groupe positionné sur `place.pos` (y = 0) et tourné de `rotation` (façade vers le sapin, comme `rot` aujourd'hui).
- Construction par matériau (≤ 7 draw calls par chalet) : **façade** (corps + pignon, `colors[facade]`, roughness 0.85) ; **blanc** (deux pans de toit en `box` inclinés, calottes de neige débordant de 0,12 m, congère : sphère aplatie scale [1.6, 0.25, 1.6] au pied, chapeau de cheminée ; `colors["snow"]`) ; **bois** (porte 0,9 × 2 m, encadrements de fenêtres, cheminée 0,45 × 1 × 0,45, balcon pour `storey`, poutres d'angle pour `aframe` ; `colors["wood"]`) ; **fenêtres** (2 à 4 plans 0,9 × 0,9 émissifs `meshBasicMaterial` `colors["lantern"]`, `toneMapped={false}`) ; **couronne** (torus 0,22 × 0,05 sur la porte, `colors["needle-dark"]`) ; **lanterne de porte** (`box` 0,14 émissif) ; **enseigne** (plane 1,1 × 0,3 au-dessus de la porte avec `useLabelTexture(place.name.replace(/^(Le |La |L')/, ""))`). `ChimneySmoke` conservé, enveloppé dans un `<group position={[cx - 0.55, cy - 2.55, cz + 0.3]}>` pour partir de la cheminée du variant.
- Dimensions par variant (largeur × hauteur de mur × profondeur) : gable 2,6 × 1,7 × 2,0, toit à 40° ; aframe 2,2 × 0,9 × 2,0 avec toit à 62° jusqu'à 3,4 m ; storey 2,4 × 2,6 × 2,0, toit à 35°, balcon 1,6 × 0,1 × 0,5 à 1,5 m. Emprise totale ≤ 2,9 × 2,2 (calotte comprise). Porte 2 m = repère d'échelle.
- Graine : `seeded(seed)` décale la teinte de façade de ± 0,03 (`color.offsetHSL`) et la position de la cheminée (± 0,2 m) ; deux chalets de même variant diffèrent visiblement.

- [ ] **Step 1 : Lancer** `npx tsc --noEmit` après avoir écrit `geometry.ts` → Expected : 0 erreur (pas de test jsdom : R3F ne monte pas ; la tâche est vérifiée par la capture du step 4).
- [ ] **Step 2 : Implémenter `Chalet.tsx`** et remplacer `House` dans `Village.tsx` : `{CHALETS.map(c => { const place = PLACES.find(p => p.id === c.id)!; return <Chalet key={c.id} place={place} variant={c.variant} facade={c.facade} seed={c.seed} rotation={-Math.atan2(place.pos[2], place.pos[0]) - Math.PI / 2} shadows={mode === "desktop"} />; })}`. Supprimer `House` et le memo `houses`.
- [ ] **Step 3 : `npx tsc --noEmit` et `npx vitest run`** → Expected : 0 erreur, tous PASS.
- [ ] **Step 4 : Capture** : lancer `LOVABLE_PREVIEW_HOST=id-preview--d1897ca2-0b6e-4b73-94a1-162b7886c71f.lovable.app npx vite dev --port 4174` (arrière-plan) et le script scratchpad `scene_shots.py` (Edge headless, reduced-motion, 1440 × 900 : vue par défaut après « Visiter librement », `__villageActivities.overview()`, ambiances jour et nuit, et un gros plan sur la Chocolaterie via `camera.position.set(9.5, 2.2, 4); controls.target.set(9, 1, 0)` exposé par `__villageActivities.viewGift`-like helper ajouté au probe : `viewPlace(id)`). Expected : 8 chalets distincts, portes et enseignes lisibles, aucune erreur console.
- [ ] **Step 5 : Prêt à committer** — `feat(scene): cartoon chalets with merged geometry and place signs`.

### Task 3 : Grand sapin, forêt instanciée et bonshommes

**Files:**
- Create: `src/components/scene/nature.tsx` (`BigTree`, `Forest`, `Snowman`)
- Modify: `src/components/Village.tsx` (supprimer `Tree` 124–139, `BigTree` 141–173, `Snowman` 212–231, memo `trees` 253–259 ; rendu lignes 277, 279–284)
- Modify: `src/components/VillageActivities.tsx:27` (étoile : conserver y = 6,6)

**Interfaces:**
- `export function BigTree({ activities, shadows }: { activities: ActivityProps; shadows: boolean })` : tronc (cylindre 0,35/0,45 × 1,2, `bark`), 5 étages depuis `TREE_TIERS` (cônes 9 segments, `needle` / `needle-dark` alternés, `flatShading`), pointes de neige (cône `snow` de 40 % du rayon posé sur chaque étage, merged en une géométrie), 60 lumières en **un** `instancedMesh` (sphère 0,07, `meshBasicMaterial toneMapped={false}`, `setColorAt` rouge/or/bleu/blanc depuis `colors`) dont les couleurs scintillent via `instanceColor` toutes les 2 frames, 3 paquets décoratifs (`box`) au pied en `red`/`blue`/`gold`, `TreeDecorations` et le `pointLight` existant conservés, `onClick` → `activities.onActivity("tree")` conservé. Positions des lumières : `seeded(7)`, rayon `treeRadiusAt(y) · 0.95`.
- `export function Forest({ shadows }: { shadows: boolean })` : `forestPlacements()` rendus avec drei `Instances` : un `Instances` pour les troncs (cylindre), un pour les 3 étages de feuillage (cône, scale par étage), un pour les calottes de neige (cône `snow` plus petit, offset vertical). `limit={82 * 3}`, `castShadow={shadows}`, `frustumCulled`.
- `export function Snowman({ position, shadows, seed }: { position: [number, number, number]; shadows: boolean; seed: number })` : trois boules (0,55/0,4/0,3), chapeau (cylindre + bord), écharpe (torus `scarf` + pan `box`), 3 boutons et 2 yeux (sphères `bark`), nez carotte (cône `copper`), bras-brindilles (2 cylindres fins `bark` inclinés), sourire (5 petites sphères). Deux géométries fusionnées : blanche et sombre, + nez + écharpe.

- [ ] **Step 1 : Implémenter `nature.tsx`** et brancher dans `Scene` : `<BigTree activities={activities} shadows={shadows} />`, `<Forest shadows={shadows} />` (remplace les deux `Tree` fixes et la boucle `trees`), `<Snowman position={[4, 0, 3]} seed={1} shadows={shadows} />`, `<Snowman position={[-4.5, 0, -2.5]} seed={2} shadows={shadows} />`. Supprimer `Tree`, `BigTree`, `Snowman`, `rand` si plus utilisé par `Snow` (sinon le remplacer par `seeded`).
- [ ] **Step 2 : `npx tsc --noEmit` et `npx vitest run`** → Expected : 0 erreur, tous PASS.
- [ ] **Step 3 : Capture** (`scene_shots.py`) + `__villageActivities.viewGift(3)` et `viewGift(4)` (cadeaux sous les petits sapins) → Expected : cadeaux visibles et dégagés ; boules (`__villageActivities` n'ajoute pas de boules : ouvrir le panneau Activités → Sapin, ajouter 10 boules par clics, capturer) posées sur le feuillage et non flottantes.
- [ ] **Step 4 : Prêt à committer** — `feat(scene): big tree with instanced lights, instanced forest and snowmen`.

### Task 4 : Sol, chemins, paillettes et lac gelé

**Files:**
- Modify: `src/components/scene/nature.tsx` (`Ground`, `Lake`)
- Modify: `src/components/Village.tsx` (sol lignes 266–269 ; `TeleportTarget` inchangé)

**Interfaces:**
- `export function Ground({ radius, shadows }: { radius: number; shadows: boolean })` : `circleGeometry(radius, 96)` dont les sommets au-delà de r = 12 reçoivent `y = 0.15 · (0.5 + 0.5 · sin(x · 0.7) · cos(z · 0.6))` lissé à 0 entre r = 12 et 13 (relief nul dans la zone de marche), `meshStandardMaterial` `colors["snow"]` roughness 1, `receiveShadow` ; anneau de chemin `ringGeometry(5.6, 6.4, 64)` à y = 0,01 et 8 rayons (`planeGeometry` 0,7 × 4,6, de r = 3 à r = 7,6 vers chaque chalet) en `colors["path"]`, fusionnés en une géométrie `polygonOffset` ; paillettes `drei Sparkles` `count={600} scale={[2 * radius, 0.3, 2 * radius]} position-y={0.08} size={1.6} speed={0.15} opacity={0.7} color={colors["snow"]}`.
- `export function Lake({ shadows }: { shadows: boolean })` : `THREE.Shape` ellipse (`absellipse(0, 0, LAKE.rx, LAKE.rz, …)`) → `shapeGeometry` tournée à plat à y = 0,012 et `LAKE.rotation`, `meshStandardMaterial` `colors["ice"]` roughness 0,15 metalness 0,1 `envMapIntensity 0.6` ; bordure de neige = seconde ellipse (rx + 0,35, rz + 0,35) à y = 0,008 en `colors["snow"]` roughness 1 ; 6 petits monticules (sphères aplaties) autour, merged.

- [ ] **Step 1 : Implémenter** `Ground` et `Lake`, remplacer le `mesh` sol de `Scene` par `<Ground radius={mode === "ar" ? 23 : 40} shadows={shadows} />` et ajouter `<Lake shadows={shadows} />`.
- [ ] **Step 2 : `npx tsc --noEmit` et `npx vitest run`** → Expected : 0 erreur, tous PASS.
- [ ] **Step 3 : Capture** vue par défaut + `overview()` + ambiance jour → Expected : chemins lisibles, lac visible entre le Chalet des Contes et le Marché, sol plat dans l'anneau, relief doux vers la forêt.
- [ ] **Step 4 : Prêt à committer** — `feat(scene): snowy ground with paths and sparkles, frozen lake`.

### Task 5 : Lampadaires, halos et guirlandes

**Files:**
- Create: `src/components/scene/lights.tsx` (`LampPosts`, `Garlands`)
- Modify: `src/components/Village.tsx` (`Scene`)

**Interfaces:**
- `export function LampPosts({ ambience, desktop }: { ambience: Ambience; desktop: boolean })` : pour `LAMP_POSTS` : **un** `instancedMesh` de fûts (géométrie merged : socle `box` 0,36 × 0,12 × 0,36, fût cylindre 0,06/0,08 × 2,5, bras `box` 0,4 × 0,05 × 0,05, chapeau cône, calotte de neige ; `colors["stone"]`), **un** `instancedMesh` de têtes vitrées (`box` 0,28 × 0,34 × 0,28, `meshBasicMaterial` `colors["lantern"]` `toneMapped={false}`), **un** `instancedMesh` de halos au sol (`circleGeometry(1.6, 24)` à y = 0,02, `meshBasicMaterial` transparent, `map` = texture canvas dégradé radial blanc→transparent, `color` lantern, `opacity={lampPoolOpacity(ambience)}`, `depthWrite={false}`, `blending={THREE.AdditiveBlending}`) ; en desktop seulement, 3 `pointLight` (intensity 6, distance 7, decay 2, `castShadow={false}`) sur les 3 lampadaires les plus proches de `[0, 0, 7.5]` (tri par distance en `useMemo`). Hauteur de tête : 2,6 m.
- `export function Garlands()` : pour `garlandSpans()` : câbles = **un** `lineSegments` (`bufferGeometry` construite en `useMemo` : par câble 24 segments d'une chaînette entre `from` et `to` à y = 2,9 avec affaissement 0,45 m au milieu, `lineBasicMaterial` `colors["bark"]`) ; ampoules = **un** `instancedMesh` 8 × 14 = 112 sphères 0,06 (`meshBasicMaterial toneMapped={false}`), couleurs `red/gold/blue/green` en rotation via `setColorAt`, scintillement : toutes les 3 frames, `instanceColor` multiplié par 0,6–1 selon `sin(t · 4 + i)`.

- [ ] **Step 1 : Implémenter `lights.tsx`** et ajouter dans `Scene` : `<LampPosts ambience={ambience} desktop={mode === "desktop"} />`, `<Garlands />`.
- [ ] **Step 2 : `npx tsc --noEmit` et `npx vitest run`** → Expected : 0 erreur, tous PASS.
- [ ] **Step 3 : Capture** nuit (vue par défaut, `overview()`) et jour → Expected : la nuit, pools chauds discrets entre les chalets et guirlandes scintillantes ; le jour, halos invisibles (opacité 0) et ampoules colorées visibles ; aucune ombre portée par les lampadaires.
- [ ] **Step 4 : Prêt à committer** — `feat(scene): lamp posts with painted light pools and twinkling garlands`.

### Task 6 : Sonde de stats, budget, captures finales et PR

**Files:**
- Create: `src/components/scene/StatsProbe.tsx`
- Modify: `src/components/Village.tsx` (`ActivityProbe` : ajouter `viewPlace(id)` ; monter `<StatsProbe />` dans `Scene`)
- Modify: `XR_CHECKS.md` (section « Décor 3D »), `POINTS_REPORTES.md` si besoin
- Create: `.git/pr-body.md`

**Interfaces:**
- `declare global { interface Window { __villageStats?: () => { calls: number; triangles: number; geometries: number; textures: number; programs: number } } }` ; `StatsProbe` lit `useThree(s => s.gl).info` (`render.calls`, `render.triangles`, `memory.geometries`, `memory.textures`, `programs?.length`) ; monté uniquement si `import.meta.env.DEV`.
- `window.__villageActivities.viewPlace(id)` : caméra à 3,5 m devant le lieu, à 2,2 m de haut, cible le lieu à 1 m.

- [ ] **Step 1 : Implémenter `StatsProbe`** et `viewPlace`.
- [ ] **Step 2 : Mesurer** via Playwright : `__villageStats()` à la vue par défaut, à `overview()` et à `viewPlace("chocolaterie")`, en nuit et en jour. Expected : `calls ≤ 120` et `triangles ≤ 180000` à la vue par défaut ; noter les valeurs. Si dépassé : réduire `smoothness` des `box` à 1, puis fusionner davantage de pièces par matériau, puis réduire la forêt à 64 arbres — dans cet ordre.
- [ ] **Step 3 : Vérifier le traîneau** : `__sleigh.sim(4)` après avoir simulé un parcours (route Playwright avec `tour-mock.json` existant, en-tête `x-tss-serialized: true`) → `__sleigh.snapshot().position` à 1 cm de `sleighDestination("chocolaterie")` = `[6.5, 0.2, 0]` et capture : le traîneau n'intersecte ni lampadaire ni chalet.
- [ ] **Step 4 : `npm run build`** → Expected : OK. `npx eslint --rule 'prettier/prettier: off' src/components/scene src/lib/village-props.ts src/lib/xr-navigation.ts src/components/Village.tsx src/components/VillageWeather.tsx src/test/village-props.test.ts` → 0 erreur.
- [ ] **Step 5 : Captures finales** 1440 × 900 et 390 × 844 : vue par défaut, `overview()`, `viewPlace` pour 3 chalets, lac, lampadaires de nuit, trois ambiances. Montrer à l'utilisateur.
- [ ] **Step 6 : Documenter** : `XR_CHECKS.md` (valeurs de `__villageStats`, ce qui reste à vérifier sur Quest 2 : fluidité, lisibilité des enseignes à 3 m, lampadaires bloquant la marche ; sur AR : rayon 23 respecté) ; `.git/pr-body.md` (Summary / Changes / Verification / Checklist, anglais, sans mention d'IA).
- [ ] **Step 7 : Compte rendu final** selon `CLAUDE.local.md` avec les commandes git (branche `feat/scene-decor`, un commit par tâche, `-s`, co-auteur, push, `gh pr create`).

---

## Auto-revue

- **Couverture spec §7 (PR2a)** : chalets (T2), grand sapin instancié (T3), forêt 80 arbres en `Instances` (T3), sol relief + chemin + paillettes (T4), lac sans patineurs (T4), lampadaires + halos + 3 `PointLight` desktop (T5), guirlandes (T5), bonshommes (T3), `village-props.ts` + `OBSTACLES` + `safeLanding` (T1), sonde `__villageStats` et budget (T6), ombres desktop seulement (prop `shadows` partout), AR rayon 23 (T1 test forêt ≤ 21, T4 `Ground radius`), direction artistique (biseaux via `RoundedBoxGeometry`, matériaux mats, calottes de neige séparées, émissifs en `meshBasicMaterial`). Enclos, rennes, lutins, patineurs, `gait.ts` → PR2b.
- **Cohérence des noms** : `CHALETS`, `LAMP_POSTS`, `OBSTACLES`, `LAKE`, `PADDOCK`, `TREE_TIERS`, `treeRadiusAt`, `insideLake`, `forestPlacements`, `garlandSpans`, `lampPoolOpacity`, `seeded`, `merged`, `box`, `useMerged`, `useLabelTexture`, prop `shadows` — définis en T1/T2 et consommés tels quels en T2–T6.
- **Review Focus** : 1 → test cadeaux/forêt/lac/lampadaires (T1) ; 2 → test `sleighDestination` (T1) + simulation (T6) ; 3 → test `safeLanding`/`walkOnGround` (T1) ; 4 → test `treeRadiusAt` (T1) + capture boules (T3) ; 5 → test forêt ≤ 21 (T1).
