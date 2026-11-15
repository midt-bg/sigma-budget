// Browser probes and case lists preserved from motion.py.
export const CLS_JS = `() => { window.__cls = 0; window.__clsAll = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__clsAll += e.value;
  if ((e.sources || []).some(s => s.node && s.node.closest && s.node.closest('#view'))) window.__cls += e.value; } }).observe({ type: 'layout-shift', buffered: true }); } catch (e) {} }`;
export const RUNNING = `() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#view')).length`;
export const OBSERVERS_JS =
  '(() => {\n  const Native = window.IntersectionObserver;\n  window.__motionObservers = [];\n  window.IntersectionObserver = class extends Native {\n    constructor(callback, options) { super(callback, options); this.targets = new Set(); window.__motionObservers.push(this); }\n    observe(el) { this.targets.add(el); super.observe(el); }\n    unobserve(el) { this.targets.delete(el); super.unobserve(el); }\n    disconnect() { this.targets.clear(); super.disconnect(); }\n  };\n})()';
