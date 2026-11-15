export const readComparisonGrid = () => {
  const g = document.querySelector('#s15-t-grid') || document.querySelector('table.data');
  if (!g) return null;
  const out: Record<string, string[]> = {};
  g.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
    const th = tr.querySelector('th');
    const name = (th?.firstChild?.textContent ?? tr.children[0]?.textContent ?? '').trim();
    out[name] = [...tr.children].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
  });
  return out;
};
export const ROUTES = [
  ['home', '#/'],
  ['izpalnenie', '#/izpalnenie'],
  ['izp-2024', '#/izpalnenie?g1=2024&g2=2025&obhvat=eu&rez=mesec'],
  ['razhodi', '#/razhodi'],
  ['prihodi', '#/prihodi'],
  ['danaci', '#/danaci'],
  ['tarsene', '#/tarsene?q=%D0%94%D0%94%D0%A1'],
  ['izp-budzheti', '#/izpalnenie/byudzheti'],
  ['vedomstva', '#/vedomstva'],
];
export const measureTouchTargets = () => {
  const sel =
    'button, input:not([type=hidden]), select, textarea, summary, [role=tab], [role=button], .btn, a.btn, a.tab, .seg label, a[class*=card], a[class*=link-card]';
  const bad = [];
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden], details:not([open]) > :not(summary), .sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (
      cs.visibility === 'hidden' ||
      cs.display === 'none' ||
      (cs.position === 'absolute' && (r.width < 2 || r.height < 2))
    )
      continue;
    // the hit area of a hidden native input is its label
    let box: Pick<DOMRect, 'width' | 'height'> = r;
    if (el.matches('input[type=radio],input[type=checkbox]')) {
      const l =
        el.closest('label') ||
        (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]'));
      if (l) box = l.getBoundingClientRect();
    }
    // a link inside a sentence gets its hit area from an ::after box (layout.css, pointer:coarse): measure that box
    const pa = getComputedStyle(el, '::after');
    if (pa.content !== 'none' && pa.position === 'absolute') {
      const pw = parseFloat(pa.width),
        ph = parseFloat(pa.height);
      if (pw > box.width || ph > box.height)
        box = { width: Math.max(pw || 0, box.width), height: Math.max(ph || 0, box.height) };
    }
    if (box.height < 43.5 || box.width < 43.5)
      bad.push({
        n: (
          el.getAttribute('aria-label') ||
          el.textContent ||
          el.getAttribute('name') ||
          el.id ||
          el.tagName
        )
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40),
        w: Math.round(box.width),
        h: Math.round(box.height),
        t: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
      });
  }
  return bad;
};
export const measureOverflow = () => {
  const de = document.documentElement;
  const wide = [];
  for (const el of document.querySelectorAll('main *, #main *')) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    if (
      r.right > de.clientWidth + 1 &&
      !el.closest(
        '.table-wrap, [data-ui="table"], svg, .chart, pre, .map-svg, [data-scroll], .sr-only, .tab-list, [role=tablist]',
      ) &&
      getComputedStyle(el).position !== 'fixed'
    )
      wide.push(
        el.tagName.toLowerCase() +
          (el.id ? '#' + el.id : '') +
          '.' +
          String(el.className).slice(0, 30) +
          ' right=' +
          Math.round(r.right),
      );
  }
  const grid = document.querySelector('#s15-t-grid-wrap, [data-route] .s01-wrap');
  return {
    page: de.scrollWidth - de.clientWidth,
    wide: wide.slice(0, 4),
    gridOver: grid ? grid.scrollWidth - grid.clientWidth : 0,
  };
};
export const inspectFocus = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el),
    r = el.getBoundingClientRect();
  const ring =
    (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') ||
    (cs.boxShadow && cs.boxShadow !== 'none');
  const wrap = el.closest('label, .seg, details, .field');
  let ring2 = false;
  if (!ring && wrap) {
    const w = getComputedStyle(wrap);
    ring2 =
      (parseFloat(w.outlineWidth) > 0 && w.outlineStyle !== 'none') ||
      (w.boxShadow !== '' && w.boxShadow !== 'none');
  }
  const sib = el.nextElementSibling; // a visually hidden radio draws its ring on the label
  let ring3 = false;
  if (!ring && !ring2 && el.id) {
    const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
    if (l) {
      const w = getComputedStyle(l);
      ring3 =
        (parseFloat(w.outlineWidth) > 0 && w.outlineStyle !== 'none') ||
        (w.boxShadow !== '' && w.boxShadow !== 'none');
    }
  }
  const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  const lab = el.closest('label');
  let ringL = false;
  if (lab) {
    const w = getComputedStyle(lab);
    ringL = parseFloat(w.outlineWidth) > 0 && w.outlineStyle !== 'none';
  }
  const seg = !!el.closest('.seg');
  let ring4 = false;
  if (seg && el.nextElementSibling) {
    const w = getComputedStyle(el.nextElementSibling);
    ring4 =
      (parseFloat(w.outlineWidth) > 0 && w.outlineStyle !== 'none') ||
      (w.boxShadow !== '' && w.boxShadow !== 'none');
  }
  // a range input draws its ring on the thumb pseudo-element: look for that rule in the style sheets
  const sliderRing =
    el.matches('input[type=range]') &&
    [...document.styleSheets].some((ss) => {
      try {
        return [...ss.cssRules].some(
          (r) =>
            r instanceof CSSStyleRule &&
            r.selectorText &&
            /focus-visible::-webkit-slider-thumb/.test(r.selectorText) &&
            /outline:\s*[1-9]/.test(r.cssText),
        );
      } catch (e) {
        return false;
      }
    });
  const prev = window.__prevFocus;
  window.__prevFocus = el;
  const back = !!(
    prev &&
    prev !== el &&
    prev.isConnected &&
    !(prev.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  return {
    back,
    n: (
      el.getAttribute('aria-label') ||
      el.textContent ||
      el.getAttribute('name') ||
      el.id ||
      el.tagName
    )
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 36),
    tag: el.tagName.toLowerCase(),
    top: Math.round(r.top + scrollY),
    ring: !!(ring || ring2 || ring3 || ringL || ring4 || outline || sliderRing),
  };
};
