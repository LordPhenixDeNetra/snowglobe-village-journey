# Points reportés

Constats faits pendant le travail, hors périmètre de la PR en cours. Un point sort de la liste quand il est traité.

## 2026-11-13 — PR1 interface (accueil et barre d'actions)

- **`npm run lint` échoue déjà sur `main`** : 7 384 erreurs `prettier/prettier`, surtout des fins de ligne CRLF (`core.autocrlf=true` sur Windows) et des fichiers existants non formatés (`ImmersiveVillage.tsx`, `SantaSleigh.tsx`, `src/components/ui/*`). Décision : ne pas reformater le dépôt dans une PR fonctionnelle ; vérifier ESLint sans la règle Prettier sur les fichiers modifiés. À traiter dans une PR dédiée (`prettier --write` + `.gitattributes` `* text=auto eol=lf`).
- **Un échec de chargement du traîneau GLB fait tomber toute la page** : `useGLTF` lève dans `SantaSleigh`, le `Suspense` n'a pas de limite d'erreur, et `__root` affiche « This page didn't load ». Vu en local sans `LOVABLE_PREVIEW_HOST` (l'asset `/__l5e/assets-v1/...` répond 404). À traiter : limite d'erreur autour de `SantaSleigh` pour que le village reste visible sans traîneau.
- **`vite preview` ne sert pas la build** : la préréglage nitro/cloudflare écrit `.output/`, mais `@tanstack/start-plugin-core` attend `dist/server/server.js`. Les captures locales passent par `vite dev` avec `LOVABLE_PREVIEW_HOST=id-preview--d1897ca2-0b6e-4b73-94a1-162b7886c71f.lovable.app`.
- **Libellé « Nuit polaire »** passe sur deux lignes dans le groupe Ambiance d'un panneau de 360 px ; acceptable, mais un libellé court dans `AMBIENCE_LABELS` (partagé avec la VR) serait plus propre.
