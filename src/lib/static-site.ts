// The GitHub Pages build (vite.pages.config.ts) defines VITE_STATIC_SITE: no server functions there, and
// media files are copied next to the site instead of being served by Lovable's /__l5e/ asset route.
declare global {
  interface ImportMetaEnv {
    readonly VITE_STATIC_SITE?: string;
  }
}

export const STATIC_SITE = import.meta.env.VITE_STATIC_SITE === "true";

/** URL of a Lovable asset descriptor: its Lovable route online, `media/<file>` under the site base on Pages. */
export function assetUrl(asset: { url: string; original_filename: string }): string {
  return STATIC_SITE ? `${import.meta.env.BASE_URL}media/${asset.original_filename}` : asset.url;
}

export const AI_NOTICE = STATIC_SITE
  ? "Version hors ligne : réponse imaginaire préparée à l’avance, sans IA"
  : "Réponse imaginaire générée par IA";
