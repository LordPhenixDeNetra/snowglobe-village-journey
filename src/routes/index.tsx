import { createFileRoute } from "@tanstack/react-router";
import Village from "@/components/Village";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Village de Noël WebXR" },
      {
        name: "description",
        content:
          "Explorez le village en VR ou AR : lettres au Père Noël, chasse aux cinq cadeaux et décoration du grand sapin.",
      },
      { property: "og:title", content: "Village de Noël WebXR" },
      {
        property: "og:description",
        content:
          "Lettres au Père Noël, cadeaux cachés et sapin interactif dans un village de Noël en 3D, VR et AR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Village,
});
