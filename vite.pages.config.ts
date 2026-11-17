// Static build for GitHub Pages (used only by .github/workflows/pages.yml; Lovable keeps vite.config.ts).
// Pages serves files only: the app is built as a single-page app under the repository sub-path, and
// VITE_STATIC_SITE switches the AI tour and Santa's letter to their offline versions.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const base = process.env.PAGES_BASE ?? "/snowglobe-village-journey/";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // The shell is rendered for the sub-path the router will see, so hydration matches.
    spa: {
      enabled: true,
      maskPath: base,
      prerender: { outputPath: "/index.html", crawlLinks: false },
    },
  },
  vite: {
    base,
    define: { "import.meta.env.VITE_STATIC_SITE": JSON.stringify("true") },
  },
});
