<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Village points of interest live in src/lib/village-places.ts; the AI tour server function may only return ids from that list, so keep scene and AI catalog in sync.
- Sleigh motion is pure TypeScript in src/lib/sleigh-motion.ts; its renderer follows the active catalog stop to keep movement testable and destinations synchronized.
- Christmas music uses one gesture-started Web Audio mixer and licensed CDN assets; no autoplay avoids browser blocking and unwanted sound.
- Development probes: window.__sleigh.snapshot()/sim(seconds) inspect and advance live motion, and window.__christmasAudio() measures playback time, RMS and peak; these hooks do not ship in production.
- ImmersiveVillage owns session-specific origins, locomotion, headset controls and AR hit-test placement; desktop camera controls must never run inside XR sessions to avoid overriding tracked head poses.
- Ground destinations and AR scale constraints live in pure xr-navigation helpers with tests so teleport safety and catalog viewpoints stay synchronized.
- VR walking uses headset-relative, eased left-stick input and safe ground movement in xr-navigation; keep the origin at metre scale and floor height so local-floor preserves the visitor's tracked eye height.
- Poll each VR thumbstick independently, with pure controllerTurn rules, so turning does not require a connected left controller; use XR button events for physical tour actions.
- AR creates optional session anchors from fresh hit-test frames and releases them on reposition/unmount; fall back to a fixed world pose and provide world-space controls when DOM overlays are unavailable.
- Music and immersive recordings share the gesture-started audio-mixer context; VR/AR narration uses French browser speech synthesis, ducks both buses, cancels on stop changes/session exit, and never queues old stops.
- Immersive audio sources use catalog positions transformed by the scene group (scaled/rotated miniature in AR, world-fixed metre scale in VR); listener pose follows the tracked camera for HRTF spatialization and mode-specific attenuation.
- Weather state is shared across desktop/VR/AR, with pure village-weather rules and global CSS scene color tokens; AR never draws a sky over the camera feed.
- Chimney smoke and moving-sleigh stars use bounded instanced particles outside React state; polar aurora is a local animated shader with no remote sky dependency.
- Activity rules and the five-gift catalog live in village-activities; session-only activity state is shared by desktop, VR and AR to avoid divergent counts and decorations.
- Santa letter generation runs only in a validated server function; never persist visitor letters or log their contents, and treat them as untrusted prompt data.
- New activity scene colors use global scene tokens; fireworks use a bounded instanced pool and ornaments/garlands have device-safe caps.
- Development-only __villageActivities.viewGift(index)/overview() controls the camera for render checks; it never collects gifts or bypasses progression.
