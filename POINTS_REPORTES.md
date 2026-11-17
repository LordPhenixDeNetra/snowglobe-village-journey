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

## 2026-11-17 — PR2b personnages

- **Pas d'ombre portée des personnages** : la passe d'ombre doublait leurs draw calls (vue par défaut 127 > 120). Ils paraissent un peu posés sur la neige ; une ombre peinte au sol (un disque instancié, 1 draw call) les ancrerait.
- **Chasse aux cadeaux lancée** : la vue d'ensemble de jour monte à 177 draw calls (vue par défaut 127), au-delà du budget mesuré hors chasse ; les cadeaux en comptent la plus grande part (≈ 168 sans les personnages). À mesurer et réduire dans la PR qui touchera les activités.
- **Patineurs** : décalés d'un quart de boucle (un demi les ferait se croiser au centre en même temps), ils passent à ≈ 1,5 m l'un de l'autre, bras écartés presque bout à bout ; le lac de 4,4 × 3 m est petit pour deux silhouettes de 1,6 m.
- **Clic sur le Père Noël** : il active l'activité « Poste » (onglet actif, caméra vers la Poste) comme le clic sur le sapin, mais n'ouvre pas le panneau Activités ; l'ouvrir demanderait de remonter `setPanel` jusqu'à `Scene`.
- **Mouvement réduit** : les personnages s'animent même avec `prefers-reduced-motion`, comme la fumée et les guirlandes.
- **Père Noël à 710 triangles** (cible 700) : la boucle de ceinture et l'ourlet blanc dépassent de 10 triangles.
- **Contrôle `__sleigh.sim(4)` → `[6.5, 0.2, 0]`** : il demande un parcours (fonction serveur IA) ; vérifié à la place sur l'arrêt de la Poste (`[-4.6, 0.2, 4.6]`).
- Revue PR2b : petites allocations par frame dans l'animation des personnages (tableaux renvoyés par `quadrupedLegs`/`bipedLimbs`/`skateLean`, fermetures recréées, `forEach`) ; à passer en tampons réutilisés.
- Revue PR2b : les pattes en élan du renne raclent la neige (aucune levée du pied pour la paire diagonale qui avance) ; ajouter une flexion du genou proportionnelle à `max(0, cos(phase·2π))`.
- Revue PR2b : les rennes qui broutent gardent le museau à ~0,4 m au-dessus de la neige ; baisser davantage le cou ou la tête.
- Revue PR2b : les tests de placement vérifient le centre des personnages, pas leur emprise (tête du renne, cadeau du lutin) ; soustraire un rayon d'emprise.

## 2026-11-17 — PR3 interface VR/AR

Points mineurs relevés en revue :

- Canvas VR : si Fredoka se charge après le premier dessin, seuls les boutons redessinés (survol, état) passent en Fredoka ; redessiner après `document.fonts.ready`.
- `WorldPanel` : boutons transparents qui écrivent la profondeur devant un verre qui ne l'écrit pas ; risque de coins qui percent le verre selon le tri (`renderOrder` ou `alphaTest`) — à confirmer en casque.
- « Promenade libre » est actif mais sans effet (et sans gestionnaire dans le repli AR) ; le désactiver hors parcours.
- Double impulsion haptique sur « Point de vue suivant » et sur le bouton d'étape (`visit` → `land` vibre déjà).
- AR : la pastille d'état n'est pas cliquable, un tap dessus peut poser le village quand une surface est détectée.
- `ActionBar` : `forceMobile` est inutilisé et le `createPortal` est redondant quand la barre est déjà dans le conteneur.
- Réticule AR : couleur de secours `"white"` pendant la première image ; ne rendre le réticule qu'une fois les couleurs lues.
- Overlay AR : pas de marges `safe-area-inset-left/right` (téléphone en paysage avec encoche).
