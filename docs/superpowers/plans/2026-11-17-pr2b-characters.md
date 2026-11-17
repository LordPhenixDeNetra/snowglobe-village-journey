# PR2b — Personnages animés : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire vivre le village : 3 rennes dans un enclos (1 trotte, 2 broutent), 3 lutins près de l'Atelier (1 marche vers le sapin, 2 travaillent), le Père Noël devant la Poste (il salue pendant l'activité « lettre »), 2 patineurs sur le lac — sans dépasser le budget Quest 2.

**Architecture:** La locomotion est un module pur testé `src/lib/gait.ts` (phase avancée par la distance, paires diagonales, contre-balancement des bras, suivi de route à lacet borné). Les routes et positions vivent dans `src/lib/village-props.ts` et sont testées contre les obstacles. Le rendu `src/components/scene/characters.tsx` dessine chaque *type de pièce* (pattes, corps, têtes…) en **un `instancedMesh` partagé par tous les personnages**, mis à jour dans `useFrame` : quelques draw calls pour toute la population.

**Tech Stack:** three 0.187, @react-three/fiber 9, Vitest, Playwright (captures).

**Spec:** `docs/superpowers/specs/2026-11-13-refonte-ui-3d-design.md` §7.1–7.4 (lignes « 3 rennes », « 3 lutins + Père Noël », « Patineurs », module `gait.ts`).

## Contexte d'exécution

- Dossier de travail : `N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\React_Project\snowglobe-pr2b` (worktree git, branche `feat/scene-characters`, partie de `main` 451f6c4). Une autre PR (interface VR/AR, dossier `snowglobe-pr3`) avance en parallèle : **ne touchez ni `src/components/ImmersiveVillage.tsx`, ni `src/components/shell/`, ni `src/components/xr/`**.
- `node_modules` est une jonction vers celui du projet principal. Pour les captures, créez un `vite.capture.config.ts` non versionné (déjà exclu par git) : `import { defineConfig } from "@lovable.dev/vite-tanstack-config"; export default defineConfig({ tanstackStart: { server: { entry: "server" } }, vite: { cacheDir: "node_modules/.vite-pr2b" } });` puis `LOVABLE_PREVIEW_HOST=id-preview--d1897ca2-0b6e-4b73-94a1-162b7886c71f.lovable.app npx vite dev --config vite.capture.config.ts --port 4175 --strictPort` en arrière-plan.
- Captures : Python Playwright, `channel="msedge"`, args `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`, `reduced_motion="reduce"`, attendre `[data-scene-ready]`, cliquer « Visiter librement », attendre ~1,5 s par vue. Sondes dev : `window.__villageActivities.{overview(), viewPlace(id), look(from, to), viewGift(i)}`, `window.__villageStats()` (un rendu contrôlé, ombres incluses), `window.__sleigh`.

## Global Constraints

- **Ne jamais committer** (règle de l'utilisateur) : chaque tâche se termine « prêt à committer » ; aucune mention d'outil IA dans les fichiers.
- Aucune nouvelle dépendance ; géométrie procédurale ; couleurs uniquement via tokens `--scene-*` oklch lus par `useWeatherColors` (ajouter les tokens manquants dans `src/styles.css` et la liste de `VillageWeather.tsx`).
- 1 unité = 1 m. Échelles : renne 1,5 m au garrot (bois compris ≈ 2,1 m), lutin 1,1 m, Père Noël 1,9 m, patineur 1,6 m.
- Budget : vue d'ensemble (`overview()`) ≤ 150 draw calls et ≤ 200 k triangles avec `__villageStats()` (aujourd'hui 135 / 144 k) ; vue par défaut ≤ 120 / ≤ 180 k (aujourd'hui 109 / 136 k). Les personnages ne projettent d'ombre qu'en desktop ; si le budget est dépassé, les personnages ne projettent plus d'ombre du tout.
- Animations hors React : `useFrame` + refs, `dt` borné à 0,05 s, aucune allocation par frame (objets temporaires créés une fois).
- Les personnages n'ont pas de collision et ne reçoivent pas de clic, sauf le Père Noël (clic → `activities.onActivity("letter")`).
- Les fichiers de tests et de lib existants gardent leurs attentes ; `PLACES`, `GIFTS`, `safeLanding`, `viewpoint`, `sleighDestination`, `SLEIGH_ARC` inchangés.
- Lovable : ne pas toucher `drizzle/`, `supabase/`, `src/generated/`, `src/routeTree.gen.ts`.

## Review Focus

1. Un personnage qui traverse un chalet, un lampadaire, le sapin ou la clôture de l'enclos — tests de distance sur toutes les routes (tâche 1).
2. Le Père Noël ou un lutin posé sur un point de vue VR ou sur la place de parking du traîneau : le visiteur téléporté apparaît dans le personnage — tests (tâche 1).
3. Un renne qui « patine » (pieds qui glissent) quand sa vitesse change — test phase ∝ distance (tâche 2).
4. Onglet en arrière-plan puis retour : un `dt` énorme téléporte les marcheurs — `dt` borné, test `followRoute` (tâche 2).
5. Budget dépassé sur la vue d'ensemble — mesure (tâche 5).

---

### Task 1 : Positions et routes des personnages (pur, testé)

**Files:** Modify `src/lib/village-props.ts` ; Test `src/test/village-props.test.ts` (ajouts).

**Interfaces — Produces :**
```ts
export type Route = { points: XZ[]; loop: boolean };
export const REINDEER: { route: Route | null; at: XZ; yaw: number; redNose: boolean }[]; // 3 ; [0] trotte sur une boucle dans l'enclos, [1],[2] fixes (broutent)
export const PADDOCK_FENCE: XZ[];        // 14 poteaux sur le cercle PADDOCK.r
export const ELVES: { route: Route | null; at: XZ; yaw: number; task: "walk" | "hammer" | "wave"; seed: number }[]; // 3
export const SANTA: { at: XZ; yaw: number };
export const SKATERS: { route: Route; phase: number }[]; // 2, même « 8 », décalés d'une demi-boucle
export function routeLength(route: Route): number;
export function sampleRoute(route: Route, step?: number): XZ[]; // points tous les `step` m (0,1 par défaut)
```
Valeurs :
- `REINDEER[0].route` : boucle de 8 points sur un cercle de rayon `PADDOCK.r − 0,8` autour de `PADDOCK.center` ; `[1]`, `[2]` à ±0,9 m du centre, regards opposés ; `redNose` vrai pour `[0]`.
- `PADDOCK_FENCE` : 14 poteaux à `PADDOCK.r` sauf une ouverture de 2 poteaux côté village (angle vers l'origine).
- Lutins : Atelier = `PLACES` id `atelier-jouets` (angle 45°). `[0]` route aller-retour (loop) le long du rayon à 45° de r = 3,6 à r = 6,6 (le chemin tassé) avec un léger détour latéral de 0,3 m au milieu ; `[1]` « hammer » et `[2]` « wave » fixes à r = 7,1, décalés tangentiellement de ±1,1 m, tournés vers le visiteur (vers l'origine).
- Père Noël : à r = 7,0 sur l'angle de `poste-pere-noel` (135°), décalé tangentiellement de +1,3 m, tourné vers l'origine.
- Patineurs : « 8 » de 16 points (lemniscate) dans le repère du lac, demi-axes 1,6 × 0,9 m, transformé par `LAKE.center` et `LAKE.rotation` (même convention que `insideLake`).

- [ ] **Step 1 : Tests** (dans `village-props.test.ts`) :
  ```ts
  it("les rennes restent dans l'enclos, loin de la clôture", () => {
    for (const r of REINDEER) for (const p of r.route ? sampleRoute(r.route) : [r.at]) expect(d(p, PADDOCK.center)).toBeLessThanOrEqual(PADDOCK.r - 0.6);
    expect(PADDOCK_FENCE.length).toBe(12);
    expect(Math.hypot(...PADDOCK.center) + PADDOCK.r).toBeLessThan(21); // AR : rayon 23
  });
  it("lutins et Père Noël ne traversent ni chalet, ni lampadaire, ni sapin, et laissent libres points de vue, parking du traîneau et cadeaux", () => {
    const spots = [...ELVES.flatMap(e => e.route ? sampleRoute(e.route) : [e.at]), SANTA.at];
    for (const p of spots) {
      expect(Math.hypot(...p)).toBeGreaterThan(3.3);                       // sapin (rayon 2,6 au pied)
      for (const c of CHALETS) { const place = PLACES.find(x => x.id === c.id)!; expect(d(p, [place.pos[0], place.pos[2]])).toBeGreaterThan(1.9); }
      for (const post of LAMP_POSTS) expect(d(p, post)).toBeGreaterThan(0.7);
      for (const place of PLACES) { const [vx, , vz] = viewpoint(place); expect(d(p, [vx, vz])).toBeGreaterThan(0.8); const s = sleighDestination(place.id)!; expect(d(p, [s[0], s[2]])).toBeGreaterThan(1.6); }
      for (const g of GIFTS) expect(d(p, [g.pos[0], g.pos[2]])).toBeGreaterThan(1);
      expect(insideLake(p[0], p[1], 0.3)).toBe(false);
    }
  });
  it("les patineurs restent sur la glace", () => {
    expect(SKATERS).toHaveLength(2);
    for (const s of SKATERS) for (const p of sampleRoute(s.route)) expect(insideLake(p[0], p[1], -0.3)).toBe(true);
  });
  it("routeLength et sampleRoute sont cohérents", () => {
    const square: Route = { points: [[0, 0], [1, 0], [1, 1], [0, 1]], loop: true };
    expect(routeLength(square)).toBeCloseTo(4); expect(routeLength({ ...square, loop: false })).toBeCloseTo(3);
    expect(sampleRoute(square, 0.5)).toHaveLength(8);
  });
  ```
  Note : `insideLake(x, z, margin)` accepte une marge négative (ellipse rétrécie) — vérifier que la formule existante le supporte, sinon l'étendre.
- [ ] **Step 2 :** `npx vitest run src/test/village-props.test.ts` → FAIL (exports absents).
- [ ] **Step 3 :** Implémenter les exports ci-dessus dans `village-props.ts`.
- [ ] **Step 4 :** `npx vitest run` → tous PASS.
- [ ] **Step 5 : Prêt à committer** — `feat(scene): character placements and routes`.

### Task 2 : Module de locomotion `gait.ts`

**Files:** Create `src/lib/gait.ts` ; Test `src/test/gait.test.ts`.

**Interfaces — Produces :**
```ts
export type Walker = { distance: number; segment: number; along: number; position: XZ; yaw: number; forward: 1 | -1 };
export function startWalker(route: Route): Walker;                     // au premier point, lacet vers le second
export function followRoute(w: Walker, route: Route, speed: number, dt: number, maxYawRate: number): Walker;
  // dt borné à 0,05 ; avance de speed·dt le long de la polyligne ; boucle si route.loop, sinon fait demi-tour au bout (forward ×−1) ;
  // le lacet tourne vers la direction du segment d'au plus maxYawRate·dt ; distance cumulée.
export function stridePhase(distance: number, strideM: number): number; // fraction [0,1) = (distance / strideM) mod 1
export function quadrupedLegs(phase: number, amplitude: number): [number, number, number, number]; // [avG, avD, arG, arD] ; paires diagonales (avG, arD) et (avD, arG) en opposition
export function bipedLimbs(phase: number, amplitude: number): { legL: number; legR: number; armL: number; armR: number }; // bras opposé à la jambe du même côté
export function skateLean(phase: number): { lean: number; push: number };  // inclinaison ±0,15 rad, poussée alternée
```
- [ ] **Step 1 : Tests** (`gait.test.ts`) :
  ```ts
  it("la phase de foulée avance avec la distance, pas avec le temps", () => {
    expect(stridePhase(0, 1)).toBe(0); expect(stridePhase(0.25, 1)).toBeCloseTo(0.25); expect(stridePhase(2.5, 1)).toBeCloseTo(0.5);
    const route: Route = { points: [[0, 0], [10, 0]], loop: false };
    const still = followRoute(startWalker(route), route, 0, 0.05, 4);
    expect(still.distance).toBe(0);
  });
  it("les pattes vont par paires diagonales opposées", () => {
    const [fl, fr, hl, hr] = quadrupedLegs(0.25, 0.5);
    expect(fl).toBeCloseTo(hr); expect(fr).toBeCloseTo(hl); expect(fl).toBeCloseTo(-fr);
  });
  it("chaque bras balance à l'opposé de la jambe du même côté", () => {
    const pose = bipedLimbs(0.25, 0.6);
    expect(Math.sign(pose.armL)).toBe(-Math.sign(pose.legL)); expect(pose.legL).toBeCloseTo(-pose.legR);
  });
  it("suit une route en boucle, borne dt et le lacet", () => {
    const square: Route = { points: [[0, 0], [2, 0], [2, 2], [0, 2]], loop: true };
    let w = startWalker(square);
    w = followRoute(w, square, 1, 10, 100);            // dt énorme → borné à 0,05 s
    expect(w.distance).toBeCloseTo(0.05);
    for (let i = 0; i < 200; i++) w = followRoute(w, square, 1, 0.05, 100);
    expect(w.distance).toBeCloseTo(10.05); expect(w.position[0]).toBeCloseTo(2, 1); expect(w.position[1]).toBeCloseTo(0.05, 1); // 10,05 m = 2,5 tours + 0,05
    const turning = followRoute({ ...startWalker(square), yaw: Math.PI }, square, 1, 0.05, 2);
    expect(Math.abs(turning.yaw - Math.PI)).toBeCloseTo(0.1); // 2 rad/s × 0,05 s
  });
  it("une route ouverte fait demi-tour au bout", () => {
    const line: Route = { points: [[0, 0], [1, 0]], loop: false };
    let w = startWalker(line); for (let i = 0; i < 30; i++) w = followRoute(w, line, 1, 0.05, 100);
    expect(w.forward).toBe(-1); expect(w.position[0]).toBeCloseTo(0.5, 1);
  });
  ```
- [ ] **Step 2 :** `npx vitest run src/test/gait.test.ts` → FAIL.
- [ ] **Step 3 :** Implémenter `gait.ts` (convention de lacet : `yaw = atan2(dx, dz)`, le modèle regarde +Z, comme `SantaSleigh`).
- [ ] **Step 4 :** `npx vitest run` → tous PASS.
- [ ] **Step 5 : Prêt à committer** — `feat(scene): procedural gait and route following`.

### Task 3 : Rennes et enclos

**Files:** Create `src/components/scene/characters.tsx` (`Herd`, `Paddock`) ; Modify `src/components/Village.tsx` (`Scene` : monter `<Herd shadows={shadows} />` et `<Paddock shadows={shadows} />`).

**Interfaces :** `export function Herd({ shadows }: { shadows: boolean })` ; `export function Paddock({ shadows }: { shadows: boolean })`. Tokens ajoutés si besoin : `--scene-fur` `oklch(0.5 0.07 55)`, `--scene-fur-light` `oklch(0.82 0.04 80)`, `--scene-antler` `oklch(0.7 0.05 75)`, `--scene-nose` `oklch(0.6 0.22 25)`.

Construction (rigide, pièces articulées) : par **type de pièce** un `instancedMesh` pour tout le troupeau (`count = 3 × pièces par renne`), matrices recalculées dans `useFrame` via un `Object3D` réutilisé :
- corps (capsule ou cylindre arrondi 1,2 × 0,55, `fur`), ventre clair (`fur-light`), cou incliné, tête + museau, oreilles, bois (2 branches + 2 andouillers chacun, `antler`), queue, nez (`nose` émissif `meshBasicMaterial` pour `redNose`, sinon `bark`) ;
- 4 pattes à 2 segments (cuisse, canon) + sabots (`bark`) : angle cuisse = `quadrupedLegs(phase, 0.45)`, canon = −0,6 × cuisse ;
- `REINDEER[0]` : `followRoute` à 1,1 m/s, `stridePhase(distance, 1,1)`, léger rebond du corps (0,03 m × |sin(2πphase)|) ;
- `[1]`, `[2]` broutent : cou qui descend et remonte (période 6 s, déphasées), queue qui bat.
- Enclos : `PADDOCK_FENCE` = poteaux (instancedMesh `wood`) + 2 lisses entre poteaux voisins (instancedMesh `box` scale) + calotte de neige sur poteaux ; aucune ouverture n'est rendue entre les 2 poteaux du côté village.
- Budget visé : ≤ 900 triangles par renne ; ≤ 10 draw calls pour troupeau + enclos.

- [ ] **Step 1 :** Implémenter `Herd` et `Paddock`, les monter dans `Scene`.
- [ ] **Step 2 :** `npx tsc --noEmit` → 0 erreur ; `npx vitest run` → tous PASS.
- [ ] **Step 3 : Capture** `look([7.5, 3, -6.5], [10.3, 0.8, -10.3])` jour et nuit, plus une seconde capture 0,6 s plus tard sans `reduced_motion` pour voir le renne avancer → rennes lisibles (bois, nez rouge), pattes posées au sol, clôture continue, aucune erreur console.
- [ ] **Step 4 : Prêt à committer** — `feat(scene): reindeer herd and paddock`.

### Task 4 : Lutins, Père Noël et patineurs

**Files:** Modify `src/components/scene/characters.tsx` (`Villagers`) ; Modify `src/components/Village.tsx` (`Scene` : `<Villagers activity={activities.activity} onSanta={() => activities.onActivity("letter")} shadows={shadows} />`).

**Interfaces :** `export function Villagers({ activity, onSanta, shadows }: { activity: Activity; onSanta: () => void; shadows: boolean })`. Tokens si besoin : `--scene-skin` `oklch(0.8 0.06 55)`, `--scene-elf` = `--scene-green` existant, `--scene-beard` = `--scene-snow`.

Construction : un bipède partagé (torse effilé, ceinture, tête, chapeau pointu ou bonnet à pompon, bras et jambes à 2 segments, bottes, mains), **un `instancedMesh` par type de pièce pour les 6 bipèdes** avec `setColorAt` pour les tenues (lutins vert/rouge, Père Noël rouge + barbe blanche + ceinture noire, patineurs bleu/prune + écharpe). Échelle par instance (lutin 1,1 m, Père Noël 1,9 m, patineur 1,6 m).
- Lutin `walk` : `followRoute` 0,8 m/s, `bipedLimbs(stridePhase(distance, 0,55), 0,5)`, porte un cadeau (`box` coloré dans les mains) ; `hammer` : bras droit qui frappe (période 0,8 s) au-dessus d'un petit établi (`box` bois) ; `wave` : bras levé qui salue (période 1,4 s).
- Père Noël : immobile, respiration lente ; quand `activity === "letter"`, bras droit qui salue ; mesh de collision invisible (cylindre 0,5 × 1,9 m) portant `onClick` → `onSanta()` avec `stopPropagation`.
- Patineurs : `followRoute` 1,4 m/s sur `SKATERS[i].route` (départ décalé de `phase × routeLength`), jambes via `skateLean`, bras écartés, corps incliné dans les virages (lacet − lacet précédent).
- Budget visé : ≤ 700 triangles par bipède ; ≤ 12 draw calls pour tous les bipèdes.

- [ ] **Step 1 :** Implémenter `Villagers`, le monter dans `Scene`.
- [ ] **Step 2 :** `npx tsc --noEmit` ; `npx vitest run` → 0 erreur, tous PASS.
- [ ] **Step 3 : Captures** `viewPlace("atelier-jouets")`, `viewPlace("poste-pere-noel")` avant et après ouverture du panneau Activités → Poste (Père Noël qui salue), `look([-1.2, 4, 0.5], [-1.2, 0, -4.4])` (patineurs) ; clic sur le Père Noël (coordonnées écran via `page.mouse`) → le panneau Activités s'ouvre sur « Poste » ou l'onglet Poste est actif. Aucune erreur console.
- [ ] **Step 4 : Prêt à committer** — `feat(scene): elves, Santa and skaters`.

### Task 5 : Budget, vérifications et livraison

**Files:** Modify `XR_CHECKS.md` (paragraphe « Characters » ajouté **à la fin de la section `## 3D decor`**, pas ailleurs) ; Modify `POINTS_REPORTES.md` (section `## 2026-11-17 — PR2b personnages` en fin de fichier, seulement s'il y a des points reportés) ; Create `.git/pr-body.md` **dans le dossier git commun** : le chemin réel est `N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\React_Project\snowglobe-village-journey\.git\pr-body-pr2b.md` (nom distinct de celui de la PR3).

- [ ] **Step 1 : Mesurer** `__villageStats()` (vue par défaut nuit/jour, `overview()`, `look` sur l'enclos) → Expected : overview ≤ 150 / ≤ 200 k, défaut ≤ 120 / ≤ 180 k. Si dépassé : `castShadow` des personnages à `false`, puis fusion des pièces fixes (bois + tête) dans le corps.
- [ ] **Step 2 :** Vérifier que `__villageActivities.viewGift(0..4)` montre toujours les 5 cadeaux (chasse lancée) et que `__sleigh.sim(4)` se gare toujours à `[6.5, 0.2, 0]`.
- [ ] **Step 3 :** `npx vitest run` ; `npx tsc --noEmit` ; `npx eslint --rule 'prettier/prettier: off' src/lib/gait.ts src/lib/village-props.ts src/components/scene src/components/Village.tsx src/test/gait.test.ts src/test/village-props.test.ts` → 0 erreur ; `npm run build` → OK.
- [ ] **Step 4 :** Rédiger le corps de PR (anglais, sections Summary / Changes / Verification / Checklist, sans mention d'IA) dans `pr-body-pr2b.md`.
- [ ] **Step 5 :** Arrêter le serveur de dev (port 4175).

---

## Auto-revue
- Couverture spec §7.2 (rennes, enclos, lutins, Père Noël, patineurs, `gait.ts` pur) : T1–T4 ; budget §7.3 : T5 ; vérifs §7.4 : T5.
- Noms cohérents : `Route`, `XZ`, `REINDEER`, `PADDOCK_FENCE`, `ELVES`, `SANTA`, `SKATERS`, `routeLength`, `sampleRoute`, `startWalker`, `followRoute`, `stridePhase`, `quadrupedLegs`, `bipedLimbs`, `skateLean`, `Herd`, `Paddock`, `Villagers`.
- Review Focus : 1, 2 → tests T1 ; 3, 4 → tests T2 ; 5 → mesure T5.
