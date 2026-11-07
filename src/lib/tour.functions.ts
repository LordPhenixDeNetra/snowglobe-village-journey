import { createServerFn } from "@tanstack/react-start";
import { PLACES } from "./village-places";

export type TourStop = { id: string; note: string };
export type TourResult = { title: string; stops: TourStop[] } | { error: string };

export const planTour = createServerFn({ method: "POST" })
  .inputValidator((input: { wish: string }) => {
    const wish = String(input?.wish ?? "").trim().slice(0, 500);
    if (!wish) throw new Error("Décrivez ce que vous souhaitez découvrir.");
    return { wish };
  })
  .handler(async ({ data }): Promise<TourResult> => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const ids = PLACES.map((p) => p.id);
    const catalog = PLACES.map((p) => `- ${p.id}: ${p.name} — ${p.desc}`).join("\n");
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Tu es le guide chaleureux d'un village de Noël. Compose un parcours de 3 à 6 étapes, uniquement parmi les lieux fournis, dans un ordre agréable. Pour chaque étape, écris une courte phrase (max 25 mots) en français expliquant pourquoi elle correspond au souhait du visiteur.",
        input: `Lieux du village :\n${catalog}\n\nSouhait du visiteur : ${data.wish}`,
        text: {
          format: {
            type: "json_schema",
            name: "parcours",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "stops"],
              properties: {
                title: { type: "string" },
                stops: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "note"],
                    properties: { id: { type: "string", enum: ids }, note: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") {
          for (const c of item.content) if (c.type === "output_text") text += c.text;
        }
      }
      const parsed = JSON.parse(text) as { title: string; stops: TourStop[] };
      const stops = parsed.stops.filter((s) => ids.includes(s.id));
      if (!stops.length) return { error: "Le guide n'a pas trouvé de parcours. Essayez une autre envie." };
      return { title: parsed.title, stops };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("planTour gateway error", e.code, e.ids);
        if (e.code === "rate_limited") return { error: "Trop de demandes, réessayez dans un instant." };
        if (e.code === "payment_required") return { error: "Le guide est indisponible (crédits IA épuisés)." };
        return { error: "Le guide est momentanément indisponible." };
      }
      console.error("planTour error", e);
      return { error: "Le guide n'a pas pu préparer votre parcours." };
    }
  });
