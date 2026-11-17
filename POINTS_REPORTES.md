# Points reportés

Constats faits pendant le travail, hors périmètre de la PR en cours. Un point sort de la liste quand il est traité.

La PR de nettoyage (#6) a traité la plupart des points relevés pendant la refonte UI/3D : traîneau qui faisait tomber la page, budget de la chasse aux cadeaux, finitions du décor, des personnages et de l'interface ; la PR des petits points a ensuite traité le survol des cadeaux, l'image noire au montage, les nouvelles tentatives du traîneau, l'aurore et la vibration VR. Le réglage « réduire les animations » n'est pas un défaut : la spec §5.3 prévoit que les animations de scène continuent. Restent :

## Outillage

- **`vite preview` ne sert pas la build** : le préréglage nitro/cloudflare écrit `.output/`, mais `@tanstack/start-plugin-core` attend `dist/server/server.js`. Les captures locales passent par `vite dev` avec `LOVABLE_PREVIEW_HOST=id-preview--d1897ca2-0b6e-4b73-94a1-162b7886c71f.lovable.app`.

## Scène

- **Triangles par élément au-dessus de la spec** : chalets ≈ 1,5–2,5 k (spec ≤ 600), bonshommes ≈ 0,8 k estimé (spec ≤ 400) après allègement des sphères. Le budget global est largement tenu (vue d'ensemble ≈ 105 draw calls / 102 k triangles).
- **Patineurs** : 1,53 m au plus près l'un de l'autre (1,6 m impossible sur un « 8 » dans ce lac) ; bras rapprochés pour que les mains ne se touchent pas.

## Vérifications à faire

- **Chemin réel de `SceneErrorBoundary`** (promesse Suspense rejetée par `useGLTF`) : couvert seulement par une capture en 404, pas par le test unitaire.
- **Contrôle `__sleigh.sim(4)` → `[6.5, 0.2, 0]`** : il demande un parcours (fonction serveur IA).
- **Matériel** : tout ce qui est listé dans `XR_CHECKS.md` (Quest 2, téléphone AR).

## GitHub Pages

- **Erreur récupérable d'hydratation (#422) sur la copie statique** : React abandonne l'hydratation de la coquille prérendue et rend le bloc Suspense côté client. Aucun effet visible (vérifié : accueil, parcours, lettre, musique, traîneau), et l'app Lovable n'est pas concernée. Piste : la coquille SPA de TanStack Start avec une route `ssr: false`.
- **Médias en double** : `public/media/` copie les 4 fichiers CC0 servis par Lovable ; si un média change dans Lovable, le recopier ici.
