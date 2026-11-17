import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Extra attempts after a failure; each waits twice as long as the previous one. */
  retries?: number;
  retryDelayMs?: number;
  /** Called just before a new attempt, e.g. to evict a cached failed load. */
  onRetry?: () => void;
};

/** Keeps the village on screen when one optional scene element (e.g. the sleigh GLB) fails to load,
 *  and tries it again a few times so a brief network outage does not remove it for the whole visit. */
export class SceneErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn("Scene element failed to load", error);
    const { retries = 0, retryDelayMs = 5000, onRetry } = this.props;
    if (this.attempts >= retries) return;
    const delay = retryDelayMs * 2 ** this.attempts;
    this.attempts++;
    this.timer = setTimeout(() => {
      onRetry?.();
      this.setState({ failed: false });
    }, delay);
  }
  override componentWillUnmount() {
    clearTimeout(this.timer);
  }
  override render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
