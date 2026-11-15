type LayoutShift = PerformanceEntry & {
  hadRecentInput: boolean;
  value: number;
  sources?: { node?: Node }[];
};
declare global {
  interface Window {
    __HASH_ROUTES__: boolean;
    __ROUTES__: { id: string; bare?: boolean; samples: string[] }[];
    __cls: number;
    __clsAll: number;
    __prevFocus: Element | null;
    __motionObservers: { targets: Set<Element> }[];
  }
}
export const observeLayoutShifts = () => {
  window.__cls = 0;
  window.__clsAll = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as LayoutShift[]) {
      if (entry.hadRecentInput) continue;
      window.__clsAll += entry.value;
      if (entry.sources?.some(({ node }) => node instanceof Element && node.closest('#view')))
        window.__cls += entry.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });
};
export const runningAnimations = () =>
  document.getAnimations().filter((animation) => {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    return (
      animation.playState === 'running' && target instanceof Element && target.closest('#view')
    );
  }).length;
export const trackMotionObservers = () => {
  const NativeObserver = window.IntersectionObserver;
  window.__motionObservers = [];
  window.IntersectionObserver = class extends NativeObserver {
    readonly targets = new Set<Element>();
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super(callback, options);
      window.__motionObservers.push(this);
    }
    override observe(element: Element) {
      this.targets.add(element);
      super.observe(element);
    }
    override unobserve(element: Element) {
      this.targets.delete(element);
      super.unobserve(element);
    }
    override disconnect() {
      this.targets.clear();
      super.disconnect();
    }
  };
};
