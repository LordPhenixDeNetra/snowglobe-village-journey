# Points reportés

Constats faits pendant le travail, hors périmètre de la PR en cours. Un point sort de la liste quand il est traité.

La PR de nettoyage (#6) a traité la plupart des points relevés pendant la refonte UI/3D : traîneau qui faisait tomber la page, budget de la chasse aux cadeaux, finitions du décor, des personnages et de l'interface. Le réglage « réduire les animations » n'est pas un défaut : la spec §5.3 prévoit que les animations de scène continuent. Restent :

## Outillage

- **`vite preview` ne sert pas la build** : le préréglage nitro/cloudflare écrit `.output/`, mais `@tanstack/start-plugin-core` attend `dist/server/server.js`. Les captures locales passent par `vite dev` avec `LOVABLE_PREVIEW_HOST=id-preview--d1897ca2-0b6e-4b73-94a1-162b7886c71f.lovable.app`.

## Scène

- **Triangles par élément au-dessus de la spec** : chalets ≈ 1,5–2,7 k (spec ≤ 600), bonshommes ≈ 1,8 k (spec ≤ 400). Le budget global est largement tenu (vue d'ensemble ≈ 105 draw calls / 111 k triangles).
- **Patineurs** : 1,53 m au plus près l'un de l'autre (1,6 m impossible sur un « 8 » dans ce lac) ; bras rapprochés pour que les mains ne se touchent pas.
- **Survol d'un cadeau peu visible la nuit** : la teinte éclaircie remplace l'ancienne lueur émissive ; un léger agrandissement de l'instance survolée se verrait sous tous les éclairages.
- **Image noire possible au montage** des chalets et lampadaires : les couleurs par sommet sont écrites dans un `useEffect` (`useTintedMerge`) ; les remplir dans le `useMemo` ou un `useLayoutEffect`.
- **Traîneau sans nouvel essai** : après un échec de chargement, il ne revient qu'au rechargement de la page ; `SceneErrorBoundary` masque aussi un vrai bug de rendu de `SantaSleigh` (un seul `console.warn`).
- **Premier passage en nuit** : le shader de l'aurore se compile à ce moment (programmes 29 → 30), petit à-coup possible.

## Interface VR

- **Point de vue refusé sans retour** : si `safeLanding` refuse la destination, « stop » et « point de vue suivant » ne vibrent plus du tout ; vibrer dans `press` quand `land` refuse.

## Vérifications à faire

- **Feux d'artifice après le 5ᵉ cadeau** depuis l'instanciation des cadeaux : non rejoués en capture.
- **Chemin réel de `SceneErrorBoundary`** (promesse Suspense rejetée par `useGLTF`) : couvert seulement par une capture en 404, pas par le test unitaire.
- **Contrôle `__sleigh.sim(4)` → `[6.5, 0.2, 0]`** : il demande un parcours (fonction serveur IA).
- **Matériel** : tout ce qui est listé dans `XR_CHECKS.md` (Quest 2, téléphone AR).
