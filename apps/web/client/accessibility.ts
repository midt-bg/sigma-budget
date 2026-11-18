// The upstream script remains byte-identical; DOM/ARIA and reflow fixes belong here.
declare const accessibility: (options: {
  parentSelector: string;
  navSelector: string;
  mainSelector: string;
  lng: string;
  hideSelectors: string[];
  textVersionOnCallbacks: Array<() => void>;
  textVersionOffCallbacks: Array<() => void>;
}) => Promise<void>;

let started = false;
export async function initAccessibility(): Promise<void> {
  if (started || document.body.classList.contains('bare')) return;
  started = true;
  // Deferred classic scripts finish before DOMContentLoaded; the shell may start earlier.
  if (document.readyState === 'loading') {
    await new Promise<void>((resolve) =>
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true }),
    );
  }
  if (typeof accessibility !== 'function') return;
  const root = document.documentElement;
  const tables = new Map<HTMLDetailsElement, boolean>();
  const syncText = () => {
    if (!root.classList.contains('a11y-textonly')) return;
    // The plugin disables all stylesheets. Keep our safety rules and disable newly
    // loaded route styles too (navigation doesn't reload this persistent wrapper).
    for (const sheet of document.styleSheets) {
      sheet.disabled = !sheet.href?.endsWith('/css/accessibility.css');
    }
    document.querySelectorAll<HTMLDetailsElement>('details.fig-table').forEach((table) => {
      if (!tables.has(table)) tables.set(table, table.open);
      if (!table.open) table.open = true;
    });
  };
  try {
    // Upstream toggles the root and body after fetching translations. Its body starts
    // clean; reconcile the prepaint root immediately after initialization (before paint).
    await accessibility({
      parentSelector: 'body',
      navSelector: '#topbar',
      mainSelector: '#main',
      lng: 'bg',
      // CSS hides current AND future graphics; don't let upstream set stale inline styles.
      hideSelectors: [],
      textVersionOnCallbacks: [
        () => {
          root.classList.add('a11y-textonly');
          syncText();
        },
      ],
      textVersionOffCallbacks: [
        () => {
          root.classList.remove('a11y-textonly');
          tables.forEach((open, table) => {
            table.open = open;
          });
          tables.clear();
        },
      ],
    });
    for (const mode of ['font-resize', 'dyslectic-font']) {
      root.classList.toggle(mode, document.body.classList.contains(mode));
    }
    const toolbar = document.querySelector<HTMLElement>('.accessibility-controls')!;
    // The vendor owns keyboard/ARIA. Keep our native skip link first and the trigger second.
    document.querySelector('.skip-link')?.after(toolbar);
    document.querySelector('.accessibility-content')?.remove();
    document.head.addEventListener('load', syncText, true);
    new MutationObserver(syncText).observe(document.head, { childList: true, subtree: true });
    new MutationObserver(syncText).observe(document.querySelector('#view')!, {
      childList: true,
      subtree: true,
    });
  } catch (error) {
    console.warn('Accessibility controls could not be initialized', error);
  }
}
