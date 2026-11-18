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
  if (started) return;
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
    const toolbar = document.querySelector<HTMLElement>('.accessibility-controls')!;
    const button = toolbar.querySelector<HTMLButtonElement>('.a11y-tools__button')!;
    const panel = toolbar.querySelector<HTMLElement>('.a11y-tools__nav')!;
    // Keep the site's skip link first in the document's keyboard order.
    document.body.append(toolbar);
    toolbar.removeAttribute('tabindex');
    panel.removeAttribute('tabindex');
    panel.id = 'accessibility-panel';
    panel.setAttribute('aria-label', 'Настройки за достъпност');
    button.tabIndex = 0;
    button.setAttribute('aria-controls', panel.id);
    const setOpen = (open: boolean) => {
      button.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    };
    setOpen(false);
    button.addEventListener('click', () => setOpen(panel.hidden));
    toolbar.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.focus();
      }
    });
    document.addEventListener('click', (event) => {
      if (!toolbar.contains(event.target as Node)) setOpen(false);
    });
    toolbar.addEventListener('focusout', (event) => {
      if (!toolbar.contains(event.relatedTarget as Node)) setOpen(false);
    });
    // Replace upstream JS-only skip links with the site's existing native skip link.
    document.querySelector('.accessibility-content')?.remove();
    const syncPressed = () => {
      for (const [selector, active] of [
        ['.a11y__item--increase button', root.classList.contains('font-resize')],
        ['.a11y__item--dyslexic button', root.classList.contains('dyslectic-font')],
        ['.a11y__item--textonly button', root.classList.contains('a11y-textonly')],
        ...['yellow', 'dark', 'blue', 'clear'].map((mode) => [
          `.a11y__btn--${mode}`,
          mode === 'clear'
            ? !/accessibility-(yellow|dark|blue)/.test(root.className)
            : root.classList.contains(`accessibility-${mode}`),
        ]),
      ] as Array<[string, boolean]>) {
        toolbar.querySelector(selector)?.setAttribute('aria-pressed', String(active));
      }
      toolbar.querySelector('.a11y__item--increase span')!.textContent = root.classList.contains(
        'font-resize',
      )
        ? 'Намали шрифта'
        : 'Увеличи шрифта';
    };
    toolbar.addEventListener('click', syncPressed);
    syncPressed();
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
