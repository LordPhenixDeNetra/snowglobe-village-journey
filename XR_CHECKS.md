# WebXR device checks

## Verified in the sandbox
- Eight tests pass: ground-level viewpoints, unsafe teleport rejection, AR scale limits, sleigh motion and route matching.
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
3. Adjust **Taille de la maquette**, select **Repositionner**, and place it elsewhere.
4. A pre-created tour should retain Next/Previous controls on devices supporting DOM overlays.
5. Select **Quitter l’AR** or use the browser's session exit.

AR placement uses a fixed XR world position from the horizontal hit test, not a persistent cross-session anchor. Devices without DOM overlays can tap/select to place but may not expose resizing and tour controls. Tracking stability, performance, audio continuity and device input need these device checks.