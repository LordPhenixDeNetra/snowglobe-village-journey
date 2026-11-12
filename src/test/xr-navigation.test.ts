import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/village-places";
import { safeLanding, viewpoint, scaleForAR, walkingTarget, walkingVelocity, walkOnGround, WALK_SPEED, VR_WORLD_SCALE, controllerTurn, horizontalHit } from "@/lib/xr-navigation";

describe("immersive navigation", () => {
  it("turns with the right controller alone and rearms a 30-degree snap on release", () => {
    expect(controllerTurn(1, false, true, 0.016).angle).toBeCloseTo(-Math.PI / 6);
    expect(controllerTurn(1, false, false, 0.016)).toEqual({ angle: 0, armed: false });
    expect(controllerTurn(0, false, false, 0.016)).toEqual({ angle: 0, armed: true });
    expect(controllerTurn(-1, false, true, 0.016).angle).toBeCloseTo(Math.PI / 6);
  });
  it("keeps smooth right-stick turning consistent and caps stalled frames", () => {
    expect(controllerTurn(1, true, true, 1).angle).toBe(-0.05);
    expect(controllerTurn(-1, true, true, 0.02).angle).toBe(0.02);
    expect(controllerTurn(0.1, true, true, 0.02).angle).toBe(0);
  });
  it("places AR only on finite horizontal surface poses", () => {
    const pose = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0.4, 0.8, -1, 1];
    expect(horizontalHit(pose)).toBe(true);
    expect(horizontalHit(pose.map((value, index) => index === 5 ? 0 : value))).toBe(false);
    expect(horizontalHit(pose.map((value, index) => index === 12 ? NaN : value))).toBe(false);
    expect(horizontalHit([])).toBe(false);
  });
  it("walks forward and sideways relative to the headset at real-world scale", () => {
    expect(VR_WORLD_SCALE).toBe(1);
    expect(walkingTarget(0, -1, { x: 0, z: -1 })).toEqual({ x: 0, z: -WALK_SPEED });
    expect(walkingTarget(1, 0, { x: 0, z: -1 })).toEqual({ x: WALK_SPEED, z: 0 });
    expect(walkingTarget(0, -1, { x: 1, z: 0 })).toEqual({ x: WALK_SPEED, z: 0 });
    expect(Math.hypot(...Object.values(walkingTarget(1, 1, { x: 0, z: -1 })))).toBeCloseTo(1.2);
  });
  it("ignores resting joystick noise and eases into and out of walking", () => {
    expect(walkingTarget(0.05, -0.05, { x: 0, z: -1 })).toEqual({ x: 0, z: 0 });
    const moving = walkingVelocity({ x: 0, z: 0 }, { x: 1.2, z: 0 }, 0.05);
    expect(moving.x).toBeCloseTo(1.2 * (1 - Math.exp(-0.4)));
    expect(walkingVelocity(moving, { x: 0, z: 0 }, 0.05).x).toBeLessThan(moving.x);
  });
  it("keeps walking at ground level without entering buildings or crossing the boundary", () => {
    expect(walkOnGround([0, 1.7, 6], { x: 1.2, z: 0 }, 1)).toEqual([0.06, 0, 6]);
    expect(walkOnGround([7.15, 0, 0], { x: 1.2, z: 0 }, 0.05)).toEqual([7.15, 0, 0]);
    expect(walkOnGround([0, 0, 11.99], { x: 0, z: 1.2 }, 0.05)).toEqual([0, 0, 11.99]);
    let point: [number, number, number] = [0, 0, 6];
    for (let i = 0; i < 200; i++) point = walkOnGround(point, { x: 0, z: -1.2 }, 0.05);
    expect(safeLanding(point[0], point[2])).toBe(true);
    expect(point[2]).toBeGreaterThanOrEqual(2.8);
  });
  it("keeps every quick viewpoint on safe ground at visitor foot level", () => {
    for (const place of PLACES) {
      const [x, y, z] = viewpoint(place);
      expect(y).toBe(0);
      expect(safeLanding(x, z)).toBe(true);
    }
  });
  it("rejects the tree, houses, forest and invalid destinations", () => {
    expect(safeLanding(0, 0)).toBe(false);
    expect(safeLanding(9, 0)).toBe(false);
    expect(safeLanding(20, 0)).toBe(false);
    expect(safeLanding(NaN, 3)).toBe(false);
    expect(safeLanding(0, 6)).toBe(true);
  });
  it("keeps the AR village at tabletop scale", () => {
    expect(scaleForAR(0.025)).toBe(0.025);
    expect(scaleForAR(0)).toBe(0.015);
    expect(scaleForAR(1)).toBe(0.05);
    expect(scaleForAR(NaN)).toBe(0.025);
  });
});