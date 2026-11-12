import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { PLACES } from "@/lib/village-places";

const harness = vi.hoisted(() => ({ frame: undefined as (() => void) | undefined, camera: undefined as THREE.PerspectiveCamera | undefined, listener: {} as Record<string, { value: number }>, speak: vi.fn(), cancel: vi.fn(), sourceStop: vi.fn(), sourceStart: vi.fn(), duck: vi.fn(), panners: [] as Array<{ positionX: { value: number }; positionY: { value: number }; positionZ: { value: number }; refDistance?: number; maxDistance?: number }> }));
vi.mock("@react-three/fiber", () => ({
  useThree: (select: (state: { camera: THREE.PerspectiveCamera }) => unknown) => select({ camera: harness.camera ?? new THREE.PerspectiveCamera() }),
  useFrame: (callback: () => void) => { harness.frame = callback; },
}));
vi.mock("@/lib/audio-mixer", () => ({
  duckMusic: harness.duck,
  getVillageMixer: () => ({ effects: {}, context: {
    resume: async () => {}, decodeAudioData: async () => ({}),
    listener: harness.listener,
    createBufferSource: () => ({ connect: (target: unknown) => target, disconnect: vi.fn(), start: harness.sourceStart, stop: harness.sourceStop }),
    createPanner: () => {
      const panner = { positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
      harness.panners.push(panner);
      return panner;
    },
  } }),
}));
import { useARAudio } from "@/hooks/use-ar-audio";

describe("AR audio lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks(); harness.panners = [];
    harness.camera = new THREE.PerspectiveCamera();
    harness.listener = Object.fromEntries(["positionX", "positionY", "positionZ", "forwardX", "forwardY", "forwardZ", "upX", "upY", "upZ"].map(key => [key, { value: 0 }]));
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    vi.stubGlobal("speechSynthesis", { speak: harness.speak, cancel: harness.cancel, getVoices: () => [{ lang: "fr-FR" }] });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })));
  });
  afterEach(() => vi.unstubAllGlobals());
  it("starts only after a gesture, replaces the old stop and stops both sounds on exit", async () => {
    const model = { current: new THREE.Group() };
    const { result, rerender, unmount } = renderHook(({ active, step }) => useARAudio(model, active, PLACES[step] ?? null, "Bienvenue.", step, 3), { initialProps: { active: true, step: 0 } });
    expect(harness.speak).not.toHaveBeenCalled();
    await act(async () => { await result.current.start(); });
    expect(harness.sourceStart).toHaveBeenCalledTimes(2);
    expect(harness.speak.mock.calls[0]?.[0].text).toBe("Étape 1 sur 3. Le Grand Sapin. Bienvenue.");
    rerender({ active: true, step: 1 });
    expect(harness.cancel).toHaveBeenCalledTimes(1);
    expect(harness.speak.mock.calls[1]?.[0].text).toBe("Étape 2 sur 3. La Chocolaterie. Bienvenue.");
    rerender({ active: false, step: 1 });
    expect(harness.sourceStop).toHaveBeenCalledTimes(2);
    expect(result.current.enabled).toBe(false);
    unmount();
  });
  it("transforms source positions with the placed miniature scale and orientation", async () => {
    const model = new THREE.Group(); model.position.set(1, 0.8, -2); model.scale.setScalar(0.025); model.rotation.y = Math.PI / 2;
    const { result, unmount } = renderHook(() => useARAudio({ current: model }, true, PLACES[0] ?? null, "", 0, 2));
    await act(async () => { await result.current.start(); });
    act(() => harness.frame?.());
    expect(harness.panners[0]?.positionX.value).toBeCloseTo(1);
    expect(harness.panners[0]?.positionY.value).toBeCloseTo(0.875);
    expect(harness.panners[0]?.positionZ.value).toBeCloseTo(-2);
    const chalet = PLACES.find(place => place.id === "chalet-contes");
    const expected = new THREE.Vector3(...(chalet?.pos ?? [0, 0, 0])).applyMatrix4(model.matrixWorld);
    expect(harness.panners[1]?.positionX.value).toBeCloseTo(expected.x);
    expect(harness.panners[1]?.positionZ.value).toBeCloseTo(expected.z);
    unmount();
  });
  it("tracks VR head translation and turning while sounds stay at world-scale village locations", async () => {
    const model = { current: new THREE.Group() };
    const { result, rerender, unmount } = renderHook(({ active, step }) => useARAudio(model, active, PLACES[step] ?? null, "Bienvenue en VR.", step, 3, "vr"), { initialProps: { active: true, step: 0 } });
    expect(harness.sourceStart).not.toHaveBeenCalled();
    await act(async () => { await result.current.start(); });
    const camera = harness.camera;
    if (!camera) throw new Error("Missing tracked test camera");
    camera.position.set(2, 1.7, 6); camera.rotation.y = Math.PI / 2;
    act(() => harness.frame?.());
    expect(harness.listener['positionX']?.value).toBe(2);
    expect(harness.listener['positionY']?.value).toBe(1.7);
    expect(harness.listener['positionZ']?.value).toBe(6);
    expect(harness.listener['forwardX']?.value).toBeCloseTo(-1);
    expect(harness.panners[0]?.positionX.value).toBe(0);
    expect(harness.panners[0]?.positionY.value).toBe(3);
    expect(harness.panners[0]?.refDistance).toBe(3);
    expect(harness.panners[0]?.maxDistance).toBe(35);
    camera.position.set(-4, 1.6, -2);
    act(() => harness.frame?.());
    expect(harness.listener['positionX']?.value).toBe(-4);
    expect(harness.panners[0]?.positionX.value).toBe(0);
    rerender({ active: true, step: 1 });
    expect(harness.speak.mock.calls[1]?.[0].text).toBe("Étape 2 sur 3. La Chocolaterie. Bienvenue en VR.");
    rerender({ active: false, step: 1 });
    expect(harness.sourceStop).toHaveBeenCalledTimes(2);
    expect(result.current.enabled).toBe(false);
    unmount();
  });
});