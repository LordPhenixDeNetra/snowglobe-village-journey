# WebXR device checks

## Desktop and mobile interface
The welcome screen (wish, "Visiter librement", VR/AR buttons) and the bottom action bar (Parcours, Activités, Ambiance, Musique, Immersion) were captured with Playwright at 1440, 768 and 390 px: no console error, no horizontal overflow, panels open one at a time, Escape closes and returns focus, the music element stays mounted while panels close. Text contrast on the day ambience is computed at ≥ 4.5:1 for every token pair.

## 3D decor
The village is procedural (no new assets): eight chalets in three silhouettes with place signs, a five-tier tree with instanced lights, an 82-tree instanced forest, a frozen lake, snowy ground with paths and sparkles, eight lamp posts with painted light pools, twinkling garlands and two snowmen. Lamp posts are walking obstacles (0.35 m) in `safeLanding`; placements are unit-tested against viewpoints, gifts, sleigh stops and the AR radius.

Measured on desktop with `window.__villageStats()` (one controlled render, shadow pass included): default view 109 draw calls / 136 k triangles, overview 135 / 144 k, chalet close-up 65 / 90 k. VR and AR drop decor shadows and the three lamp `PointLight`s. The five hunt gifts were captured visible, and `__sleigh.sim(4)` parks at `[6.5, 0.2, 0]` in front of the Chocolaterie. The sleigh's flight arc now peaks 3.3 m above its path so it clears the lamp-post heads (tested on every stop-to-stop trip); tree ornaments and garlands are tested to sit on the foliage; paths are tested not to cross the lake.

Requires a headset: 72 fps on Quest 2 at the default and overview positions, sign legibility at 3 m, walking stopping at a lamp post, the forest letting the controller ray reach the gifts under the small trees. In AR: the miniature stays inside the placed footprint (forest radius ≤ 21 m before scaling).

Requires a real session: entering VR or AR must hide the welcome screen, the bar and the tour chip (they render only while no XR session is active) and bring them back on exit.

**Characters.** Three reindeer in a fenced paddock (one trots a loop, two graze), three elves at the Atelier (one carries a gift between the workbench and the tree, one hammers, one waves), Santa at the Poste and two skaters on the lake. Locomotion is the pure, tested `gait.ts` (stride phase driven by distance, diagonal leg pairs, arm/leg opposition, `dt` clamped to 0.05 s, bounded yaw rate). Routes and spots are unit-tested against chalets, lamp posts, the tree, viewpoints, sleigh stops, the parked sleigh, snowmen, gifts and the lake. Every part type is one `InstancedMesh` shared by the whole cast, and characters cast no shadow, to stay in budget: default view 118 draw calls / 145 k triangles at night (115 / 144 k by day), overview 144 / 153 k (142 / 153 k by day), paddock close-up 59–61 / 84–91 k. Clicking Santa selects the Poste activity, and he waves while it is active; the five hunt gifts stay visible and the sleigh still parks in front of the Poste. Requires a headset: 72 fps on Quest 2 with the characters animating, and the controller ray passing through characters to the ground and gifts.

## Christmas activities
Santa letters were tested with a real AI response; gift progression and decoration rules have automated tests.
In VR, open **Plus…** and select **Poste**, then **Écrire / modifier** to open the world-space alphabet keyboard; send the letter and turn its pages. On AR devices with overlays, use the normal letter form. Without overlays, the world keyboard is available.
Select **Cadeaux**, find all five packages and aim the ray/trigger (VR) or tap (AR) to collect them. The fifth starts fireworks above the tree. Tree controls add colored ornaments, up to three garlands and three star effects.
Actual headset keyboard targeting, ray collection and smartphone taps remain unverified without XR hardware. Activity progress is session-only and resets on reload; letters are not stored by the app.

## Verified in the sandbox
- Fourteen tests cover ground-level viewpoints, walking, independent controller turning, horizontal AR poses, AR scale limits, sleigh motion and route matching.
- The village renders at 759×642 and 390×844 without page errors or failed asset requests.
- A real AI tour for chocolate and letters to Santa generates three stops; Next advances to the post office.
- Unsupported VR/AR modes are disabled rather than throwing an error.

## Requires real hardware
The sandbox has no XR headset, tracked controllers, camera surfaces, speakers or real GPU. Actual session entry, controller rays, comfort, AR tracking and performance remain unverified.

## Immersive interface
The VR controls are one glass panel that follows the head at 1.4 m: a first row **Précédent** · **n/N · place** (re-aims at the stop) · **Suivant**, a second row **Écouter / Couper le conteur**, **Répéter la voix**, **Point de vue suivant**, then **Plus…**, which reveals rotation, ambience, snow, the three activities (**Poste**, **Cadeaux · n/5**, **Sapin**, their tools appearing to the right of the panel) and **Quitter la VR**. The tour note is the panel title. Buttons light up with a gold outline and grow slightly under the controller ray; disabled buttons are dimmed and ignore the trigger. **Plus…** starts folded on every VR entry.

The AR DOM overlay reuses the bottom action bar with five entries (Parcours, Activités, Ambiance, Conteur, Maquette); the open panel docks above the bar inside the overlay. **Quitter l’AR** sits alone at the top right. Before placement a status pill reads "Recherche d’une surface horizontale…" then "Surface détectée", with a large gold **Poser le village** button; the reticle is a soft gold ring with a pulsing centre dot (static under reduced motion). "Suivi interrompu…" shows in the same pill when the anchor is lost. Without DOM overlays the same groups appear as one world-space glass panel.

Verified in the sandbox: panel rows, layout, label wrapping and the AR fallback rows have unit tests; the overlay (status, disabled place button, five entries, panel mounted inside the overlay, `beforexrselect` blocked) has DOM tests; the overlay was captured at 390 × 844 (no horizontal overflow, every button ≥ 44 px) and the VR panel, its **Plus…** state, its hover state and the AR fallback panel were rendered at 1440 × 900 outside a session.

Requires a headset or phone: panel legibility at 1.4 m on Quest 2, ray hover feedback, the haptic pulse on each panel action, overlay taps never placing the village, safe areas on notched phones.

### VR
Open the published HTTPS app directly in a WebXR-compatible headset browser. Create a personalized tour before selecting **Entrer en VR**.

1. Aim the controller teleport arc at open snow and release the teleport action. Your feet should stay at ground height; the tree, buildings and outer forest must reject landing.
2. Use the right thumbstick to turn. Default turning is 30-degree snaps; open **Plus…** and select **Rotation par à-coups** to switch to continuous turning (the label then reads **Rotation fluide**).
3. Select **Point de vue suivant**, then **Suivant** and **Précédent**. The viewpoint and sleigh destination should follow the selected place.
4. Turn your head: the world must stay stable and the controls remain in front of you.
5. Open **Plus…**, check the extra rows appear below without covering the first two, select **Quitter la VR** and confirm the desktop village returns. Re-enter VR: **Plus…** must be folded again.
6. With a tour active, press the right controller's A/B buttons for next/previous stops where those buttons exist. Controller rays and triggers select the panel buttons; aiming at one must outline it in gold before the trigger. Optional vibration confirms every panel action and teleportation.
7. Disconnect the left controller: the right thumbstick must still rotate. Reconnect the left controller and verify walking resumes.

### Ground walking in VR
The village uses one world unit per metre; the floor-relative headset pose supplies the visitor's real eye height, without a forced camera offset or head bob.

1. Stand and calibrate the floor in the headset, then select **Entrer en VR**. Windows and snowmen should appear at human scale; crouching should lower your view naturally.
2. Push the left thumbstick forward/backward or sideways. Walking eases toward a maximum of 1.2 metres per second, following your horizontal gaze even when looking up or down.
3. Release the stick: motion should ease to a stop. Try approaching the central tree, house walls, snowmen and forest edge; joystick motion must stop at the safe boundary.
4. Turn using the right thumbstick while walking. Rotation should pivot around your head without lifting you above the snow; teleportation and tour viewpoints should still work.

Walking direction, easing, speed limits and blocked destinations are unit-tested. Actual headset height calibration, stick input, comfort and frame rate remain unverified without XR hardware. Software collision cannot prevent physically walking into a virtual object: respect the headset's real-room boundary.

### AR
Open the published HTTPS app directly in a browser with immersive WebXR AR and hit-test support (not all mobile browsers support it), then select **Entrer en AR**.

1. Allow camera access and scan a well-lit table. The top pill reads "Recherche d’une surface horizontale…", then "Surface détectée" when a soft gold ring with a pulsing dot appears.
2. Tap the ring or the large **Poser le village** button. The miniature should stay fixed to that location without a sky obscuring the camera view.
3. Open **Maquette** in the bottom bar, adjust **Taille** and **Orientation**, select **Repositionner**, and place it elsewhere.
4. A pre-created tour shows its stop, note and Previous/Next under **Parcours**; **Activités**, **Ambiance** and **Conteur** open one panel at a time above the bar, and tapping the active entry again closes it.
5. Select **Quitter l’AR** (top right, always visible) or use the browser's session exit.

AR placement requests a session anchor when supported and falls back to a fixed XR world position otherwise; it is not a persistent cross-session save. Anchored models hide while their pose is unavailable and return when tracking recovers. Devices without DOM overlays receive one world-space glass panel with placement, tour, storyteller, resizing, rotation, ambience, activities, reposition and exit. Check that overlay taps never also place the village. Snow, lights and the tour sleigh continue animating after placement; activate music before entering immersion if desired.

Open the published HTTPS app directly, outside an embedded preview, on a browser supporting immersive WebXR. A smartphone camera alone is not enough: browsers without immersive AR/hit-test cannot place this interactive village (including many iPhone browsers). Tracking stability, performance, audio continuity, controller models and device input still require these hardware checks.

### AR storyteller and spatial ambience
1. Create a personalized tour, enter AR and place the village, then tap **Écouter le conteur**. There is no automatic audio before this gesture.
2. The voice reads the current stop in French (controls under **Conteur**). Tap Next/Previous under **Parcours**: the previous sentence must stop and the new stop should be narrated. **Répéter la narration** replays only the active stop.
3. With stereo headphones, move around the table: bells are at the Grand Sapin and crackling wood at the Chalet des Contes. Resize/rotate the miniature: sources must stay attached to their places.
4. Music and ambience should become quieter during speech. **Couper le conteur**, repositioning, lost tracking or leaving AR stops narration and ambience.
5. Browser French voices differ by device; if unavailable, the app reports the failure and keeps visual navigation. Actual voice quality, stereo perception and device gesture policies cannot be verified in the sandbox.

Narration text, gesture-only start, stop replacement, session exit and scaled/rotated source coordinates are automated-test verified with mocked devices. These are not real AR hardware checks.

### VR storyteller and spatial ambience
Create a tour, enter VR and use the controller ray/trigger to select **Écouter le conteur**. Next/Previous and A/B should replace narration with the active stop; **Répéter la voix** repeats it and **Couper le conteur** stops voice and ambience.

Walk or teleport toward the Grand Sapin and Chalet des Contes: bells and fire remain fixed at those places while the listener follows your real tracked head position and orientation. VR attenuation uses metre-scale distances, not AR tabletop distances. Exit VR and confirm both sounds and narration stop. Use stereo headphones to check left/right direction and distance; voice availability, sound quality and spatial perception on Meta Quest remain unverified without a headset.