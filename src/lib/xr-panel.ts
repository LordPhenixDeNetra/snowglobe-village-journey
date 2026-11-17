// Pure content and layout of the VR glass panel, so hierarchy and spacing stay testable outside the headset.
export type PanelButton = {
  id: string;
  label: string;
  disabled?: boolean;
  wide?: boolean;
  pressed?: boolean;
};
export type PanelState = {
  focusName: string | null;
  note: string | undefined;
  step: number;
  count: number;
  more: boolean;
  smooth: boolean;
  audio: { enabled: boolean; busy: boolean; speaking: boolean; error: string | null };
  ambienceLabel: string;
  snow: number;
  found: number;
  activity: "letter" | "hunt" | "tree" | null;
};

export const PANEL_BUTTON: [number, number] = [0.64, 0.21];
export const PANEL_GAP = 0.04;

export function vrPanelRows(s: PanelState): PanelButton[][] {
  const touring = !!s.focusName && s.count > 0;
  const rows: PanelButton[][] = [
    [
      { id: "prev", label: "Précédent", disabled: !touring || s.step <= 0 },
      {
        id: "stop",
        label: touring ? `${s.step + 1}/${s.count} · ${s.focusName}` : "Promenade libre",
        wide: true,
        disabled: !touring,
      },
      { id: "next", label: "Suivant", disabled: !touring || s.step >= s.count - 1 },
    ],
    [
      {
        id: "narrator",
        label: s.audio.busy
          ? "Chargement des sons…"
          : s.audio.enabled
            ? "Couper le conteur"
            : "Écouter le conteur",
      },
      {
        id: "repeat",
        label: s.audio.speaking ? "Le conteur parle…" : "Répéter la voix",
        disabled: !s.audio.enabled || !s.focusName,
      },
      { id: "viewpoint", label: "Point de vue suivant" },
    ],
    [{ id: "more", label: s.more ? "Moins" : "Plus…", pressed: s.more }],
  ];
  if (s.more)
    rows.push(
      [
        { id: "rotation", label: s.smooth ? "Rotation fluide" : "Rotation par à-coups" },
        { id: "ambience", label: s.ambienceLabel },
        { id: "snow", label: `Neige · ${s.snow}%` },
      ],
      [
        { id: "letter", label: "Poste", pressed: s.activity === "letter" },
        { id: "hunt", label: `Cadeaux · ${s.found}/5`, pressed: s.activity === "hunt" },
        { id: "tree", label: "Sapin", pressed: s.activity === "tree" },
      ],
      [{ id: "exit", label: "Quitter la VR" }],
    );
  if (s.audio.error) rows.push([{ id: "audio-error", label: s.audio.error, wide: true }]);
  return rows;
}

// Rows are centred horizontally and stacked top to bottom around the panel centre (metres).
export function panelLayout(
  rows: PanelButton[][],
  size: { button: [number, number]; gap: number } = { button: PANEL_BUTTON, gap: PANEL_GAP },
) {
  const [w, h] = size.button,
    gap = size.gap;
  const widthOf = (b: PanelButton) => (b.wide ? 2 * w + gap : w);
  const rowWidths = rows.map(
    (row) => row.reduce((sum, b) => sum + widthOf(b), 0) + gap * Math.max(0, row.length - 1),
  );
  const height = rows.length * h + gap * Math.max(0, rows.length - 1);
  const items: { id: string; position: [number, number]; width: number }[] = [];
  rows.forEach((row, i) => {
    let x = -(rowWidths[i] ?? 0) / 2;
    const y = height / 2 - h / 2 - i * (h + gap);
    for (const b of row) {
      const width = widthOf(b);
      items.push({ id: b.id, position: [x + width / 2, y], width });
      x += width + gap;
    }
  });
  return Object.assign(items, { width: Math.max(0, ...rowWidths), height });
}

// Word wrap by character count; the last allowed line ends with an ellipsis when text remains.
export function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines)
    return lines.map((l) => (l.length > maxChars ? `${l.slice(0, maxChars - 1)}…` : l));
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] ?? "";
  kept[maxLines - 1] = `${last.slice(0, maxChars - 1).trimEnd()}…`;
  return kept;
}

// World-space fallback for AR sessions without a DOM overlay (e.g. headset passthrough). The panel follows
// the gaze, so it starts collapsed — tour and narrator only — to keep the placed miniature visible.
export function arPanelRows(
  s: Omit<PanelState, "note" | "smooth"> & { placed: boolean; surface: boolean },
): PanelButton[][] {
  if (!s.placed)
    return [
      [
        {
          id: "place",
          label: s.surface ? "Poser le village" : "Recherche de surface…",
          disabled: !s.surface,
          wide: true,
        },
      ],
      [{ id: "exit", label: "Quitter l’AR" }],
    ];
  const shared = new Map(
    vrPanelRows({ ...s, note: undefined, more: true, smooth: false })
      .flat()
      .map((b) => [b.id, b]),
  );
  const pick = (...ids: string[]) => ids.flatMap((id) => shared.get(id) ?? []);
  const rows: PanelButton[][] = [
    pick("narrator", "repeat"),
    [
      { id: "more", label: s.more ? "Moins" : "Plus…" },
      { id: "exit", label: "Quitter l’AR" },
    ],
    ...(s.more
      ? [
          [
            { id: "smaller", label: "− Taille" },
            { id: "bigger", label: "+ Taille" },
            { id: "rotate", label: "Tourner" },
          ],
          pick("ambience", "snow"),
          pick("letter", "hunt", "tree"),
          [{ id: "reposition", label: "Repositionner" }],
        ]
      : []),
    ...(s.audio.error ? [pick("audio-error")] : []),
  ];
  // No "visit" action in AR: the stop label is shown but not pressable.
  if (s.focusName && s.count)
    rows.unshift(
      pick("prev", "stop", "next").map((b) => (b.id === "stop" ? { ...b, disabled: true } : b)),
    );
  return rows;
}
