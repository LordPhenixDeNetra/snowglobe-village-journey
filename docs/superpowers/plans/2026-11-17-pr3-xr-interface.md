# PR3 — Interface VR et AR : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les douze boutons flottants de la VR par un panneau « verre » hiérarchisé (parcours → conteur → « Plus… ») avec état de survol, et refaire l'overlay AR avec la barre d'actions et les panneaux de la PR1 (tiroir en bas, zones sûres), sans toucher à la navigation XR, à l'audio ni aux ancres.

**Architecture:** La disposition et le contenu du panneau VR sont des fonctions pures testées (`src/lib/xr-panel.ts`). Un composant `WorldPanel` (canvas → texture, une par panneau) remplace les `WorldButton` épars. En AR, `ActionBar` de la PR1 est généralisé (entrées configurables, tiroir monté dans un conteneur donné) pour vivre dans le `XRDomOverlay`. `ImmersiveVillage.tsx` est découpé : `src/components/xr/VRPanel.tsx`, `src/components/xr/AROverlay.tsx`, `src/components/xr/WorldPanel.tsx`.

**Tech Stack:** @react-three/xr 6, @react-three/fiber 9, React 19, vaul (Drawer `container`), shadcn, Lucide, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-13-refonte-ui-3d-design.md` §8 (8.1 VR, 8.2 AR, 8.3 vérifications) et §5 (identité).

## Contexte d'exécution

- Dossier de travail : `N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\React_Project\snowglobe-pr3` (worktree, branche `feat/xr-interface`, partie de `main` 451f6c4). Une autre PR (personnages 3D, dossier `snowglobe-pr2b`) avance en parallèle : **ne touchez ni `src/components/scene/`, ni `src/lib/village-props.ts`, ni `src/lib/gait.ts`, ni `src/components/Village.tsx`**, et **n'éditez pas `POINTS_REPORTES.md`** (les points reportés vont dans le compte rendu final).
- `node_modules` est une jonction. Captures : `vite.capture.config.ts` non versionné (exclu) avec `vite: { cacheDir: "node_modules/.vite-pr3" }` et `tanstackStart: { server: { entry: "server" } }` ; `LOVABLE_PREVIEW_HOST=id-preview--d1897ca2-0b6e-4b73-94a1-162b7886c71f.lovable.app npx vite dev --config vite.capture.config.ts --port 4176 --strictPort` en arrière-plan. Playwright Python + `channel="msedge"`, args swiftshader, `reduced_motion="reduce"`.
- Aucune session XR réelle n'est disponible : les composants XR se vérifient par tests purs, tests RTL des parties DOM, et une page de prévisualisation **dev uniquement** (voir tâche 4).

## Global Constraints

- **Ne jamais committer** ; aucune mention d'outil IA dans les fichiers.
- Aucune nouvelle dépendance. Couleurs : tokens (`--card`, `--primary`, `--foreground`, `--border`…) lus via `getComputedStyle` pour les canvas ; aucune couleur codée en dur.
- Comportements XR inchangés : `xr-navigation.ts`, marche, téléportation, rotation, boutons A/B, impulsions haptiques, `useImmersiveAudio` (narration, ducking), ancres AR, hit-test, `beforexrselect` bloqué sur l'overlay, aucun ciel en AR, aucun contrôle caméra desktop en session.
- VR : le panneau suit la tête à 1,4 m comme aujourd'hui ; texte canvas ≥ 48 px pour 0,21 m de haut de bouton ; Fredoka si `document.fonts.check` vrai, sinon sans-serif.
- AR overlay : 5 entrées maximum dans la barre (Parcours, Activités, Ambiance, Conteur, Maquette) ; « Quitter l'AR » à part, en haut à droite ; cibles ≥ 44 px ; zones sûres `env(safe-area-inset-*)`.
- `ActionBar` reste rétrocompatible : l'appel existant de `Village.tsx` (sans `items`) doit continuer à fonctionner sans modification ; les tests de `src/test/shell.test.tsx` restent verts sans changement de leurs attentes.
- Le rappel « Réponse imaginaire générée par IA · ne partagez pas d'adresse » reste visible partout où l'on écrit au Père Noël.
- Lovable : ne pas toucher `drizzle/`, `supabase/`, `src/generated/`, `src/routeTree.gen.ts`.

## Review Focus

1. Un tap sur l'overlay AR qui pose aussi le village (événement `select` qui traverse) — `beforexrselect` sur le conteneur du tiroir, test RTL (tâche 3).
2. Le tiroir de l'overlay rendu dans `document.body` (portail) donc invisible dans `XRDomOverlay` — test RTL du `container` (tâche 3).
3. Panneau VR : bouton désactivé qui réagit quand même au rayon — test pur `vrPanelRows` + garde dans `WorldPanel` (tâches 1–2).
4. « Plus… » ouvert puis sortie de VR : à la réentrée, le panneau doit repartir replié — état local réinitialisé au démontage (tâche 2).
5. Libellés trop longs (nom de lieu + note du parcours) débordant du bouton : coupure et ellipse dans le canvas — test pur `wrapLabel` (tâche 1).

---

### Task 1 : Disposition et contenu du panneau VR (pur, testé)

**Files:** Create `src/lib/xr-panel.ts` ; Test `src/test/xr-panel.test.ts`.

**Interfaces — Produces :**
```ts
export type PanelButton = { id: string; label: string; disabled?: boolean; wide?: boolean; pressed?: boolean };
export type PanelState = { focusName: string | null; note: string | undefined; step: number; count: number; more: boolean; smooth: boolean;
  audio: { enabled: boolean; busy: boolean; speaking: boolean; error: string | null }; ambienceLabel: string; snow: number; found: number; activity: "letter" | "hunt" | "tree" | null };
export function vrPanelRows(s: PanelState): PanelButton[][];
export function panelLayout(rows: PanelButton[][], size?: { button: [number, number]; gap: number }): { id: string; position: [number, number]; width: number }[] & { width: number; height: number };
export function wrapLabel(text: string, maxChars: number, maxLines: number): string[];
```
Contenu de `vrPanelRows` (ids stables) :
1. `["prev" "Précédent", "stop" (wide) "<n>/<N> · <lieu>" ou "Promenade libre", "next" "Suivant"]` — prev/next désactivés hors parcours ou aux bornes ; `stop` re-vise le lieu.
2. `["narrator" "Écouter le conteur" | "Couper le conteur" | "Chargement des sons…", "repeat" "Répéter la voix" (désactivé si conteur inactif ou pas de lieu), "viewpoint" "Point de vue suivant"]`.
3. `["more" "Plus…" | "Moins"]`.
4. Si `more` : `["rotation" "Rotation fluide" | "Rotation par à-coups", "ambience" ambienceLabel, "snow" "Neige · <snow>%"]`, puis `["letter" "Poste", "hunt" "Cadeaux · <found>/5", "tree" "Sapin"]` (`pressed` selon `activity`), puis `["exit" "Quitter la VR"]`.
5. Si `audio.error` : une ligne finale `["audio-error" <error>]` (wide).
Disposition : bouton 0,64 × 0,21 m, écart 0,04 m ; `wide` occupe la largeur de deux boutons + écart ; lignes centrées horizontalement, de haut en bas, origine au centre du panneau.

- [ ] **Step 1 : Tests** :
  ```ts
  const base: PanelState = { focusName: "La Chocolaterie", note: "Miam.", step: 0, count: 3, more: false, smooth: false, audio: { enabled: false, busy: false, speaking: false, error: null }, ambienceLabel: "Nuit polaire", snow: 30, found: 2, activity: null };
  it("trois niveaux : parcours, conteur, Plus…", () => {
    const rows = vrPanelRows(base);
    expect(rows.map(r => r.map(b => b.id))).toEqual([["prev", "stop", "next"], ["narrator", "repeat", "viewpoint"], ["more"]]);
    expect(rows[0]![0]!.disabled).toBe(true); expect(rows[0]![2]!.disabled).toBe(false);
    expect(rows[0]![1]!.label).toBe("1/3 · La Chocolaterie");
    expect(rows[1]![1]!.disabled).toBe(true);
  });
  it("Plus… dévoile réglages, activités et sortie", () => {
    const rows = vrPanelRows({ ...base, more: true, activity: "hunt" });
    expect(rows.flat().map(b => b.id)).toEqual(expect.arrayContaining(["rotation", "ambience", "snow", "letter", "hunt", "tree", "exit"]));
    expect(rows.flat().find(b => b.id === "hunt")).toMatchObject({ label: "Cadeaux · 2/5", pressed: true });
    expect(rows.flat().find(b => b.id === "more")!.label).toBe("Moins");
  });
  it("hors parcours : promenade libre, navigation désactivée", () => {
    const rows = vrPanelRows({ ...base, focusName: null, count: 0 });
    expect(rows[0]!.map(b => b.disabled)).toEqual([true, false, true]); expect(rows[0]![1]!.label).toBe("Promenade libre");
  });
  it("disposition centrée sans chevauchement", () => {
    const layout = panelLayout(vrPanelRows(base));
    const stop = layout.find(b => b.id === "stop")!; expect(stop.position[0]).toBeCloseTo(0); expect(stop.width).toBeCloseTo(1.32);
    const prev = layout.find(b => b.id === "prev")!, next = layout.find(b => b.id === "next")!;
    expect(prev.position[0]).toBeCloseTo(-next.position[0]); expect(next.position[0] - stop.position[0]).toBeGreaterThanOrEqual((1.32 + 0.64) / 2 + 0.04 - 1e-9);
    expect(layout.find(b => b.id === "prev")!.position[1]).toBeGreaterThan(layout.find(b => b.id === "narrator")!.position[1]);
  });
  it("coupe les libellés longs sur deux lignes avec ellipse", () => {
    expect(wrapLabel("1/3 · La Boutique de Décorations", 18, 2)).toEqual(["1/3 · La Boutique", "de Décorations"]);
    expect(wrapLabel("a ".repeat(40), 10, 2)[1]!.endsWith("…")).toBe(true);
  });
  ```
- [ ] **Step 2 :** `npx vitest run src/test/xr-panel.test.ts` → FAIL. **Step 3 :** implémenter. **Step 4 :** `npx vitest run` → PASS.
- [ ] **Step 5 : Prêt à committer** — `feat(xr): VR panel content and layout rules`.

### Task 2 : `WorldPanel` et panneau VR

**Files:** Create `src/components/xr/WorldPanel.tsx`, `src/components/xr/VRPanel.tsx` ; Modify `src/components/ImmersiveVillage.tsx` (dans `VRNavigation`, remplacer les `WorldButton` du groupe `heading` par `<VRPanel …/>` ; `WorldActivities`/`WorldLetter` restent, affichés à droite du panneau quand une activité est choisie dans « Plus… »).

**Interfaces :**
- `WorldPanel({ rows, onPress, position }: { rows: PanelButton[][]; onPress: (id: string) => void; position?: [number, number, number] })` : un fond « verre » (plan arrondi, `--card` à 72 %, bordure `--border`) + **une texture canvas par bouton** redessinée seulement quand son libellé/état change ; survol (`onPointerOver`/`onPointerOut`) → bouton éclairci (`--accent`) et échelle 1,05 ; `pressed` → fond `--primary`, texte `--primary-foreground` ; `disabled` → opacité 0,4 et **aucun appel** à `onPress` ; textures et géométries libérées au démontage.
- `VRPanel(props)` : tient l'état local `more` (réinitialisé au démontage, donc à chaque entrée en VR), construit `vrPanelRows`, mappe les ids aux actions existantes de `VRNavigation` (`onStep`, `visit`, `setSmooth`, viewpoint suivant, audio start/stop/repeat, `onAmbience(nextAmbience)`, neige +25 %, `activities.onActivity`/`onHunt`, `session.end()`), et déclenche `pulse(session)` sur chaque action.
- `WorldButton` existant reste pour le repli AR sans overlay jusqu'à la tâche 3, puis est remplacé.

- [ ] **Step 1 :** Implémenter `WorldPanel` et `VRPanel`, brancher dans `VRNavigation`.
- [ ] **Step 2 :** `npx tsc --noEmit` ; `npx vitest run` → 0 erreur, tous PASS (dont `ar-audio-lifecycle`).
- [ ] **Step 3 : Prêt à committer** — `feat(xr): glass VR panel with hierarchy and hover`.

### Task 3 : Overlay AR avec la barre d'actions

**Files:** Modify `src/components/shell/ActionBar.tsx` (généralisation rétrocompatible) ; Create `src/components/xr/AROverlay.tsx` ; Modify `src/components/ImmersiveVillage.tsx` (`ARPlacement` : remplacer le contenu du `XRDomOverlay` par `<AROverlay …/>` ; le repli sans overlay utilise `WorldPanel` avec des lignes dédiées) ; Test `src/test/xr-overlay.test.tsx`.

**Interfaces :**
- `ActionBar` : nouvelles props optionnelles `items?: { id: string; title: string; icon: LucideIcon }[]` (défaut : les 5 entrées actuelles), `container?: HTMLElement | null` (transmis au `Drawer` → `DrawerPortal container`, et la carte flottante rendue dans ce conteneur), `brand?: boolean` (défaut `true` ; `false` en AR), `forceMobile?: boolean` (force le tiroir en AR). `panels` devient `Record<string, ReactNode>`. `PanelId` reste exporté pour la compatibilité.
- `ui/drawer.tsx` : `DrawerContent` accepte `container?: HTMLElement | null` et le passe à `DrawerPortal`.
- `AROverlay({ state, actions })` où `state` = `{ placed, found, tracking, focusName, note, step, count, audio, scale, rotationDeg, ambience, snow, activities }` et `actions` = `{ place, reposition, exit, onStep, startAudio, stopAudio, repeat, onScale, onRotation, onAmbience, onSnow }` :
  - avant pose : bandeau d'état en haut (`role="status"`, « Recherche d'une surface horizontale… » / « Surface détectée ») et grand bouton or « Poser le village » (désactivé tant que `!found`) ;
  - après pose : `ActionBar` avec `items` = Parcours (`Compass`), Activités (`Gift`), Ambiance (`Moon`), Conteur (`Volume2`), Maquette (`Box`) ; `forceMobile`, `brand={false}`, `container` = l'élément racine de l'overlay ; panneaux : Parcours = étape n/N, nom, note, Précédent/Suivant ; Activités = `ActivityControls` ; Ambiance = `WeatherControls` ; Conteur = écouter/couper, répéter, état « Le conteur parle… », erreur ; Maquette = curseurs Taille (0,015–0,05) et Orientation (0–360°), bouton « Repositionner » ;
  - « Quitter l'AR » : bouton icône `X` + libellé, en haut à droite, toujours visible ;
  - « Suivi interrompu… » en bandeau quand `tracking` ;
  - le conteneur racine écoute `beforexrselect` et appelle `preventDefault()` (déplacer ici la logique existante de `ARPlacement`).
- Réticule (dans `ARPlacement`) : anneau doux + point central dont l'échelle pulse (désactivé si `prefers-reduced-motion`), `meshBasicMaterial`.

- [ ] **Step 1 : Tests** (`xr-overlay.test.tsx`, avec les mêmes mocks que `shell.test.tsx` pour `@tanstack/react-start`) :
  ```tsx
  it("avant la pose : statut et bouton Poser désactivé tant qu'aucune surface", () => {
    const { rerender } = render(<AROverlay state={{ ...arState, placed: false, found: false }} actions={arActions} />);
    expect(screen.getByRole("status")).toHaveTextContent("Recherche d'une surface horizontale…");
    expect(screen.getByRole("button", { name: "Poser le village" })).toBeDisabled();
    rerender(<AROverlay state={{ ...arState, placed: false, found: true }} actions={arActions} />);
    fireEvent.click(screen.getByRole("button", { name: "Poser le village" })); expect(arActions.place).toHaveBeenCalled();
  });
  it("après la pose : cinq entrées, Quitter à part, tiroir monté dans l'overlay", () => {
    render(<AROverlay state={{ ...arState, placed: true }} actions={arActions} />);
    const nav = screen.getByRole("navigation", { name: "Actions du village" });
    expect(within(nav).getAllByRole("button").map(b => b.textContent)).toEqual(["Parcours", "Activités", "Ambiance", "Conteur", "Maquette"]);
    fireEvent.click(screen.getByRole("button", { name: "Maquette" }));
    const root = screen.getByTestId("ar-overlay");
    expect(root.contains(screen.getByRole("dialog", { name: "Maquette" }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Quitter l.AR/ })); expect(arActions.exit).toHaveBeenCalled();
  });
  it("un tap sur l'overlay ne déclenche pas la sélection XR", () => {
    render(<AROverlay state={{ ...arState, placed: true }} actions={arActions} />);
    const event = new Event("beforexrselect", { cancelable: true }); screen.getByTestId("ar-overlay").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("ActionBar sans items garde les cinq entrées desktop", () => { /* rendu sans items → Parcours, Activités, Ambiance, Musique, Immersion */ });
  ```
  (jsdom : `useIsMobile` faux → `forceMobile` doit suffire pour obtenir le tiroir ; si vaul ne s'ouvre pas en jsdom, tester la présence du `role="dialog"` rendu dans `container`.)
- [ ] **Step 2 :** `npx vitest run src/test/xr-overlay.test.tsx` → FAIL. **Step 3 :** implémenter. **Step 4 :** `npx vitest run` → tous PASS, y compris `shell.test.tsx` inchangé.
- [ ] **Step 5 : Prêt à committer** — `feat(xr): AR overlay with action bar, drawer panels and status`.

### Task 4 : Prévisualisation, documentation et livraison

**Files:** Create `src/routes/xr-preview.tsx` **uniquement si** il est possible de le restreindre au dev (`beforeLoad` → `notFound()` si `!import.meta.env.DEV`) ; sinon pas de route et captures via tests RTL seulement. Modify `XR_CHECKS.md` (sections `### VR` et `### AR` : nouveaux libellés, « Plus… », survol au rayon, overlay en tiroir, Quitter en haut à droite). Create `N:\OneDrive - Université Cheikh Anta DIOP de DAKAR\React_Project\snowglobe-village-journey\.git\pr-body-pr3.md`.

- [ ] **Step 1 :** Si la route de prévisualisation est retenue : elle rend `AROverlay` (avant/après pose) sur un fond sombre et un `Canvas` avec `WorldPanel` devant la caméra (replié puis « Plus… ») ; captures 390 × 844 (overlay) et 1440 × 900 (panneau VR), puis vérifier qu'en build de production la route renvoie 404 (`npm run build` puis recherche de « xr-preview » absente du bundle client, ou `notFound` documenté). Note : `routeTree.gen.ts` est régénéré automatiquement par le plugin — c'est attendu pour une nouvelle route ; signaler ce fichier dans le compte rendu.
- [ ] **Step 2 :** `npx vitest run` ; `npx tsc --noEmit` ; `npx eslint --rule 'prettier/prettier: off' src/lib/xr-panel.ts src/components/xr src/components/shell src/components/ui/drawer.tsx src/components/ImmersiveVillage.tsx src/test/xr-panel.test.ts src/test/xr-overlay.test.tsx` → 0 erreur ; `npm run build` → OK.
- [ ] **Step 3 :** Mettre à jour `XR_CHECKS.md` ; rédiger `pr-body-pr3.md` (anglais, Summary / Changes / Verification / Checklist, sans mention d'IA ; lister ce qui n'est vérifiable que sur casque/téléphone).
- [ ] **Step 4 :** Arrêter le serveur de dev (port 4176).

---

## Auto-revue
- Couverture spec §8.1 (panneau verre, hiérarchie 3 niveaux, survol, haptique, texte ≥ 48 px, aucune modif de navigation) : T1–T2 ; §8.2 (barre + tiroir sans portail, 5 entrées, Quitter à part, statut avant pose, gros bouton Poser, réticule, repli sans overlay en `WorldPanel`, règles conservées) : T3 ; §8.3 (tests, captures, `XR_CHECKS.md`) : T4.
- Noms cohérents : `PanelButton`, `PanelState`, `vrPanelRows`, `panelLayout`, `wrapLabel`, `WorldPanel`, `VRPanel`, `AROverlay`, props `items`/`container`/`brand`/`forceMobile`.
- Review Focus : 1, 2 → tests T3 ; 3 → tests T1 + garde T2 ; 4 → état local T2 ; 5 → test T1.
