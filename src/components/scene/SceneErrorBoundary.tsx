import { Component, type ReactNode } from "react";

/** Keeps the village on screen when one optional scene element (e.g. the sleigh GLB) fails to load. */
export class SceneErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { console.warn("Scene element failed to load", error); }
  override render() { return this.state.failed ? this.props.fallback ?? null : this.props.children; }
}
