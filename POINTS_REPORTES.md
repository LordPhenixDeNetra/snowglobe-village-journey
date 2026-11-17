# Points reportés

Constats faits pendant le travail, hors périmètre de la PR en cours. Un point sort de la liste quand il est traité.

## 2026-11-13 — PR1 interface (accueil et barre d'actions)

- **`npm run lint` échoue déjà sur `main`** : 7 384 erreurs `prettier/prettier`, surtout des fins de ligne CRLF (`core.autocrlf=true` sur Windows) et des fichiers existants non formatés (`ImmersiveVillage.tsx`, `SantaSleigh.tsx`, `src/components/ui/*`). Décision : ne pas reformater le dépôt dans une PR fonctionnelle ; vérifier ESLint sans la règle Prettier sur les fichiers modifiés. À traiter dans une PR dédiée (`prettier --write` + `.gitattributes` `* text=auto eol=lf`).
- **Un échec de chargement du traîneau GLB fait tomber toute la page** : `useGLTF` lève dans `SantaSleigh`, le `Suspense` n'a pas de limite d'erreur, et `__root` affiche « This page didn't load ». Vu en local sans `LOVABLE_PREVIEW_HOST` (l'asset `/__l5e/assets-v1/...` répond 404). À traiter : limite d'erreur autour de `SantaSleigh` pour que le village reste visible sans traîneau.
- **`vite preview` ne sert pas la build** : la préréglage nitro/cloudflare écrit `.output/`, mais `@tanstack/start-plugin-core` attend `dist/server/server.js`. Les captures locales passent par `vite dev` avec `LOVABLE_PREVIEW_HOST=id-preview--d1897ca2-0b6e-4b73-94a1-162b7886c71f.lovable.app`.
- **Libellé « Nuit polaire »** passe sur deux lignes dans le groupe Ambiance d'un panneau de 360 px ; acceptable, mais un libellé court dans `AMBIENCE_LABELS` (partagé avec la VR) serait plus propre.

## 2026-11-17 — PR2a décor 3D

Points mineurs relevés en revue, sans effet bloquant pour le visiteur :

- Lumières et cadeaux du grand sapin (`scene/nature.tsx`) : pas de `computeBoundingSphere()` après le placement des instances ; les ampoules peuvent disparaître quand le pied du sapin sort du champ.
- Scintillement du sapin et des guirlandes cadencé en frames (> 30 Hz sur un casque à 90–120 Hz) : accumuler `dt` et mettre à jour toutes les 1/30 s.
- Passage jour ↔ crépuscule/nuit : 3 `PointLight` ajoutées ou retirées, d'où une recompilation des shaders en desktop ; les garder montées avec une intensité nulle.
- Guirlandes : le creux descend à 2,45 m (spec : ≥ 2,6 m au-dessus d'un visiteur VR).
- `RoundedBoxGeometry` à 2 segments (300 triangles par bloc) : chalets 3,4–6,7 k triangles (spec ≤ 600), bonshommes ~1,8 k (spec ≤ 400) ; le total reste dans le budget Quest. Passer à 1 segment ou à des boîtes simples pour les petites pièces.
- Chalet A-frame : porte, fenêtres, couronne et lanterne flottent de 5–10 cm devant le mur (`front` doit valoir `(d − 0,2) / 2`).
- Commentaire d'emprise du chalet (2,9 × 2,2 m) faux pour la calotte de neige (3,0 m) et la congère (3,4 × 2,7 m).
- Cadeau « foret » traversé par le tronc de son petit sapin ; décaler ce sapin d'environ 0,5 m.
- Lampadaires sans calotte de neige (prévue par la spec §7.2).
