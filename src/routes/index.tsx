import { createFileRoute } from "@tanstack/react-router";
import Village from "@/components/Village";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Village de Noël WebXR" },
      { name: "description", content: "Explorez un village de Noël enneigé en 3D, en VR ou en AR." },
      { property: "og:title", content: "Village de Noël WebXR" },
      { property: "og:description", content: "Explorez un village de Noël enneigé en 3D, en VR ou en AR." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Village,
});
