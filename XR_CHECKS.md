# WebXR device checks

## Desktop and mobile interface
The welcome screen (wish, "Visiter librement", VR/AR buttons) and the bottom action bar (Parcours, Activités, Ambiance, Musique, Immersion) were captured with Playwright at 1440, 768 and 390 px: no console error, no horizontal overflow, panels open one at a time, Escape closes and returns focus, the music element stays mounted while panels close. Text contrast on the day ambience is computed at ≥ 4.5:1 for every token pair.

Requires a real session: entering VR or AR must hide the welcome screen, the bar and the tour chip (they render only while no XR session is active) and bring them back on exit. The AR overlay and VR world panels keep their previous layout until the immersive-interface PR.

## Christmas activities
Santa letters were tested with a real AI response; gift progression and decoration rules have automated tests.
In VR, select **Poste du Père Noël**, then **Écrire / modifier** to open the world-space alphabet keyboard; send the letter and turn its pages. On AR devices with overlays, use the normal letter form. Without overlays, the world keyboard is available.
Select **Cadeaux**, find all five packages and aim the ray/trigger (VR) or tap (AR) to collect them. The fifth starts fireworks above the tree. Tree controls add colored ornaments, up to three garlands and three star effects.
Actual headset keyboard targeting, ray collection and smartphone taps remain unverified without XR hardware. Activity progress is session-only and resets on reload; letters are not stored by the app.

## Verified in the sandbox
- Fourteen tests cover ground-level viewpoints, walking, independent controller turning, horizontal AR poses, AR scale limits, sleigh motion and route matching.
- The village renders at 759×642 and 390×844 without page errors or failed asset requests.
- A real AI tour for chocolate and letters to Santa generates three stops; Next advances to the post office.
- Unsupported VR/AR modes are disabled rather than throwing an error.

## Requires real hardware
The sandbox has no XR headset, tracked controllers, camera surfaces, speakers or real GPU. Actual session entry, controller rays, comfort, AR tracking and performance remain unverified.

### VR
Open the published HTTPS app directly in a WebXR-compatible headset browser. Create a personalized tour before selecting **Entrer en VR**.

1. Aim the controller teleport arc at open snow and release the teleport action. Your feet should stay at ground height; the tree, buildings and outer forest must reject landing.
2. Use the right thumbstick to turn. Default turning is 30-degree snaps; select **Rotation fluide** for continuous turning.
3. Select **Point de vue suivant**, then **Suivant** and **Précédent**. The viewpoint and sleigh destination should follow the selected place.
4. Turn your head: the world must stay stable and the controls remain in front of you.
5. Select **Quitter la VR** and confirm the desktop village returns.
6. With a tour active, press the right controller's A/B buttons for next/previous stops where those buttons exist. Controller rays and triggers select the world buttons on other layouts; optional vibration confirms tour-button actions and teleportation.
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

1. Allow camera access and scan a well-lit table. A horizontal placement ring should appear.
2. Tap the ring or **Poser le village**. The miniature should stay fixed to that location without a sky obscuring the camera view.
3. Adjust **Taille de la maquette** and **Orientation**, select **Repositionner**, and place it elsewhere.
4. A pre-created tour should retain Next/Previous controls on devices supporting DOM overlays.
5. Select **Quitter l’AR** or use the browser's session exit.

AR placement requests a session anchor when supported and falls back to a fixed XR world position otherwise; it is not a persistent cross-session save. Anchored models hide while their pose is unavailable and return when tracking recovers. Devices without DOM overlays receive world-space placement, resizing, rotation, tour and exit controls. Check that overlay taps never also place the village. Snow, lights and the tour sleigh continue animating after placement; activate music before entering immersion if desired.

Open the published HTTPS app directly, outside an embedded preview, on a browser supporting immersive WebXR. A smartphone camera alone is not enough: browsers without immersive AR/hit-test cannot place this interactive village (including many iPhone browsers). Tracking stability, performance, audio continuity, controller models and device input still require these hardware checks.

### AR storyteller and spatial ambience
1. Create a personalized tour, enter AR and place the village, then tap **Écouter le conteur**. There is no automatic audio before this gesture.
2. The voice reads the current stop in French. Tap Next/Previous: the previous sentence must stop and the new stop should be narrated. **Répéter la narration** replays only the active stop.
3. With stereo headphones, move around the table: bells are at the Grand Sapin and crackling wood at the Chalet des Contes. Resize/rotate the miniature: sources must stay attached to their places.
4. Music and ambience should become quieter during speech. **Couper le conteur**, repositioning, lost tracking or leaving AR stops narration and ambience.
5. Browser French voices differ by device; if unavailable, the app reports the failure and keeps visual navigation. Actual voice quality, stereo perception and device gesture policies cannot be verified in the sandbox.

Narration text, gesture-only start, stop replacement, session exit and scaled/rotated source coordinates are automated-test verified with mocked devices. These are not real AR hardware checks.

### VR storyteller and spatial ambience
Create a tour, enter VR and use the controller ray/trigger to select **Écouter le conteur**. Next/Previous and A/B should replace narration with the active stop; **Répéter la voix** repeats it and **Couper le conteur** stops voice and ambience.

Walk or teleport toward the Grand Sapin and Chalet des Contes: bells and fire remain fixed at those places while the listener follows your real tracked head position and orientation. VR attenuation uses metre-scale distances, not AR tabletop distances. Exit VR and confirm both sounds and narration stop. Use stereo headphones to check left/right direction and distance; voice availability, sound quality and spatial perception on Meta Quest remain unverified without a headset.