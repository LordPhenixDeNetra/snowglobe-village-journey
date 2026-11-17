# Snowglobe Village Journey

Simulation de village de Noël por WEB XR

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d1897ca2-0b6e-4b73-94a1-162b7886c71f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## GitHub Pages

A static copy of the village is published at https://lordphenixdenetra.github.io/snowglobe-village-journey/ by `.github/workflows/pages.yml` on every push to `main` (and on demand from the Actions tab). It runs lint and tests, then `npm run build:pages`, which builds a single-page app with `vite.pages.config.ts` under the repository sub-path.

GitHub Pages has no server, so on that copy:

- the personalised tour picks one of a few themed tours written in advance from the visitor's wish (`src/lib/offline-tour.ts`);
- Santa answers letters with a prepared reply (`src/lib/offline-letter.ts`); letters stay in the browser and are never stored;
- music, ambience sounds and the sleigh model are served from `public/media/` (CC0, see `public/media/CREDITS.md`).

The Lovable deployment keeps the AI guide and Santa's AI replies. Repository setting required once: **Settings → Pages → Source: GitHub Actions**.
