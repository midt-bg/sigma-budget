/** Browser programs from screens.py, kept verbatim to preserve the audit contracts. */
export const INIT_JS = `
window.__HASH_ROUTES__ = true;   /* V7: the app opens on paths (/prihodi); these checks drive the hash addresses (#/prihodi), which js/loc.js keeps in hash mode */
(() => {
  const k = window.__chk = { csp: [], rej: [] };
  document.addEventListener('securitypolicyviolation', e => k.csp.push(\`\${e.violatedDirective} \${e.blockedURI}\`));
  window.addEventListener('unhandledrejection', e => k.rej.push(String((e.reason && (e.reason.stack || e.reason.message)) || e.reason).slice(0, 300)));
})();
`;

export const SETTLE_JS = `
() => {
  const v = document.getElementById('view');
  if (!v || v.getAttribute('aria-busy') === 'true') return false;
  const a = v.querySelector('article.page');
  if (!a || a.dataset.ready !== '1') return false;
  const vis = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  for (const c of v.querySelectorAll('.chart')) { if (vis(c) && c.dataset.ready !== '1' && c.dataset.ready !== 'err') return false; }
  if (document.fonts && document.fonts.status === 'loading') return false;
  for (const i of v.querySelectorAll('img')) if (!i.complete) return false;
  return true;
}
`;

export const DEEP_JS = `
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const v = document.getElementById('view');
  const waitCharts = async () => {
    for (let i = 0; i < 60; i++) {
      const pend = [...v.querySelectorAll('.chart')].filter(c => (c.offsetWidth || c.offsetHeight) && c.dataset.ready !== '1' && c.dataset.ready !== 'err');
      if (!pend.length) return;
      await sleep(100);
    }
  };
  let opened = 0, visited = 0;
  for (let round = 0; round < 3; round++) {                               // opening a <details> may reveal another one
    let n = 0;
    for (const d of v.querySelectorAll('details:not([open])')) { d.open = true; n++; }
    opened += n;
    if (!n) break;
    await sleep(60);
  }
  for (const list of v.querySelectorAll('[role="tablist"]')) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const first = tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0];
    for (const t of tabs) {
      if (t.getAttribute('aria-selected') === 'true') continue;
      t.click(); visited++;
      await sleep(80);
      await waitCharts();
      for (let round = 0; round < 3; round++) { let n = 0; for (const d of v.querySelectorAll('details:not([open])')) { d.open = true; n++; opened++; } if (!n) break; await sleep(50); }
    }
    if (first) { first.click(); await sleep(60); }
  }
  await waitCharts();
  return { opened, visited };
}
`;

export const AUDIT_JS = `
async (o) => {
  const P = [], info = {};
  const add = (c, l, m) => P.push({ c, l, m: String(m).slice(0, 700) });
  const view = document.getElementById('view');
  const isVis = el => { const r = el.getBoundingClientRect(); if (!(r.width || r.height)) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const path = el => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.body && parts.length < 4; e = e.parentElement) {
      let s = e.localName;
      if (e.id) { parts.unshift(s + '#' + e.id); break; }
      const c = typeof e.className === 'string' ? e.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.') : '';
      if (c) s += '.' + c;
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const take = (arr, n) => arr.slice(0, n).join('; ') + (arr.length > n ? \` (+\${arr.length - n} more)\` : '');
  const routes = await import('./js/routes.js');
  const resolves = h => { const p = String(h).split('?')[0].replace(/^#\\/?/, '').split('/').filter(Boolean); try { return !!routes.match(p.map(decodeURIComponent)); } catch { return false; } };
  const SKIP = 'code,pre,kbd,samp,textarea,script,style,template,noscript,[data-allow-tokens]';

  // ---- frame, title, landmarks
  const arts = view.querySelectorAll('article.page');
  if (arts.length !== 1) add('frame', 'fail', \`\${arts.length} article.page elements in #view (expected 1)\`);
  const art = arts[0];
  const rid = art ? art.dataset.route : null;
  info.route = rid; info.view = art ? art.dataset.view : null; info.title = document.title;
  if (art && o.expect && rid !== o.expect) add('route', 'fail', \`expected screen \${o.expect}, got \${rid}\`);
  if (art && art.dataset.ready !== '1') add('frame', 'fail', 'article.page never got data-ready=1');
  const h1s = document.querySelectorAll('h1');
  if (h1s.length !== 1) add('h1', 'fail', \`\${h1s.length} h1 elements (expected exactly 1)\`);
  else if (!h1s[0].textContent.trim()) add('h1', 'fail', 'the h1 is empty');
  else if (!view.contains(h1s[0])) add('h1', 'fail', 'the h1 is outside #view');
  info.h1 = h1s[0] ? h1s[0].textContent.trim().slice(0, 80) : '';
  if (!document.title || document.title === 'СИГМА Бюджет' || !document.title.includes(' · ')) add('title', 'fail', \`document.title is not set for the screen: "\${document.title}"\`);
  if (document.documentElement.lang !== 'bg') add('lang', 'fail', \`<html lang> is "\${document.documentElement.lang}", expected bg\`);
  const mains = document.querySelectorAll('main, [role="main"]');
  if (mains.length !== 1) add('landmark', 'fail', \`\${mains.length} main landmarks (expected 1)\`);
  for (const n of document.querySelectorAll('nav')) if (!(n.getAttribute('aria-label') || n.getAttribute('aria-labelledby'))) add('landmark', 'warn', \`nav without a label: \${path(n)}\`);
  if (document.body.firstElementChild && !document.body.firstElementChild.matches('a.skip-link')) add('landmark', 'warn', 'the skip link is not the first element of the body');
  { // heading order inside the screen
    let last = 1; const jumps = [];
    for (const h of view.querySelectorAll('h2,h3,h4,h5,h6')) {
      if (!isVis(h)) continue;
      const lv = +h.localName[1];
      if (lv > last + 1) jumps.push(\`h\${last} -> h\${lv} "\${h.textContent.trim().slice(0, 30)}"\`);
      last = lv;
    }
    if (jumps.length) add('heading-order', 'warn', \`skipped heading level: \${take(jumps, 3)}\`);
  }

  // ---- shell layout of this viewport
  const bare = document.body.classList.contains('bare');
  info.bare = bare;
  const shown = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
  const wide = window.innerWidth >= 961;   // v4: the section band collapses into the «Меню» drawer at <=960 px
  if (bare) { for (const id of ['topbar', 'sidenav', 'tabbar', 'footer', 'mockbar']) if (shown(id)) add('layout', 'fail', \`#\${id} is visible in the bare (embed) layout\`); }
  else {
    if (!shown('topbar')) add('layout', 'fail', 'the top bar is not visible');
    const navBtn = [...document.querySelectorAll('#sidenav .nav-main')].filter(isVis).length;
    if (wide && window.innerWidth >= 1241 && (!shown('sidenav') || navBtn !== 5)) add('layout', 'fail', \`wide screen: the header shows \${navBtn} group buttons (expected 5)\`);
    if (wide && shown('tabbar')) add('layout', 'fail', 'wide screen shows the bottom bar');
    if (!wide && (navBtn || [...document.querySelectorAll('#sidenav .nav-cta')].some(isVis)) && window.innerWidth <= 1240) add('layout', 'fail', 'narrow screen shows the group buttons / the red button (only the magnifier stays; the rest is in «Меню»)');
    if (!wide && !shown('tabbar')) add('layout', 'fail', 'narrow screen without the bottom bar');
    const sb = document.getElementById('btn-search');
    // V6 (26.10): the search is a magnifier button in the header (#btn-search, aria-label «Търсене», 44px target) on every screen and every width; it opens the search panel under the header
    if (!sb || !isVis(sb)) add('layout', 'fail', 'the search magnifier in the header is not visible');
    else { const q = sb.getBoundingClientRect(); if (!sb.closest('#topbar') || (sb.getAttribute('aria-label') || '') !== 'Търсене' || q.width < 44 || q.height < 44) add('layout', 'fail', \`the search button is not a 44px «Търсене» button in the header (\${Math.round(q.width)}x\${Math.round(q.height)}, label \${sb.getAttribute('aria-label')})\`); }
    if (document.querySelector('#topbar #btn-sources, #topbar #btn-more, #topbar #link-tax')) add('layout', 'fail', 'the header still holds «Източници» / ⋯ / «Моите данъци» (removed in V6)');
    if (!shown('footer')) add('layout', 'fail', 'the footer is not visible');
  }
  const bodyFs = parseFloat(getComputedStyle(document.body).fontSize);
  if (bodyFs < 15) add('font-size', 'warn', \`body font size is \${bodyFs}px\`);

  // ---- broken values in text and attributes
  const BADTXT = /(^|[^\\p{L}\\p{N}_.])(NaN|undefined|Infinity|null)(?![\\p{L}\\p{N}_])|\\[object Object\\]/u;
  const badTxt = [];
  { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue;
      if (!t || t.length < 3 || !BADTXT.test(t)) continue;
      const pe = n.parentElement;
      if (!pe || pe.closest(SKIP)) continue;
      badTxt.push(\`"\${t.trim().slice(0, 50)}" in \${path(pe)}\`);
    } }
  if (badTxt.length) add('tokens', 'fail', \`broken value in the text: \${take(badTxt, 4)}\`);
  const badAttr = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('[data-allow-tokens]') || el.closest('script,style,template')) continue;
    for (const a of el.attributes) {
      const v = a.value;
      if (v.length < 3) continue;
      if (v === 'null' || /\\bNaN\\b|\\bundefined\\b|\\[object Object\\]|Infinity/.test(v)) badAttr.push(\`\${a.name}="\${v.slice(0, 40)}" on \${path(el)}\`);
    }
  }
  if (badAttr.length) add('tokens', 'fail', \`broken value in an attribute: \${take(badAttr, 4)}\`);
  { const t = document.title; if (BADTXT.test(t)) add('tokens', 'fail', \`broken value in document.title: \${t}\`); }
  const txt = view.innerText || '';
  if (/lorem ipsum|\\bTODO\\b|\\bFIXME\\b|\\bTBD\\b|\\bXXX\\b|\\?\\?\\?/i.test(txt)) add('placeholder', 'fail', 'placeholder text on the screen (lorem / TODO / FIXME / TBD / ???)');
  if (/[ÃÂÐÑ][\\u0080-¿]|â€|�/.test(txt)) add('encoding', 'fail', 'broken character encoding on the screen');
  if (/private channel|частен канал/i.test(document.body.innerText || '')) add('public-leak', 'fail', 'the public screen mentions a private channel');
  { const en = [];
    const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue; if (!t || t.length < 12) continue;
      const m = /(^|[^\\p{L}])([a-z]{3,}\\s+[a-z]{3,}\\s+[a-z]{3,})(?![\\p{L}])/u.exec(t);
      if (m && n.parentElement && !n.parentElement.closest(SKIP + ',[lang]:not(html)')) en.push(\`"\${m[2]}"\`);
    }
    if (en.length) add('english-text', 'warn', \`English-looking text in the UI: \${take(en, 3)}\`); }

  // ---- no horizontal page scroll (except inside .table-wrap and other scrollers)
  const de = document.documentElement, iw = de.clientWidth;
  const sw = Math.max(de.scrollWidth, document.body.scrollWidth);
  info.sw = sw; info.iw = iw;
  if (sw > iw + 1) {
    const off = [];
    const scroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p.getBoundingClientRect().width <= iw + 1) return true; } return false; };
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg') && el.localName !== 'svg') continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      if (r.right <= iw + 1 && r.left >= -1) continue;
      const s = getComputedStyle(el); if (s.position === 'fixed' || s.visibility === 'hidden') continue;
      if (scroller(el)) continue;
      off.push(\`\${path(el)} [\${Math.round(r.left)}..\${Math.round(r.right)}]\`);
      if (off.length >= 6) break;
    }
    add('scroll-x', 'fail', \`the page scrolls horizontally (\${sw}px content in a \${iw}px viewport)\${off.length ? ': ' + off.join('; ') : ''}\`);
  }

  // ---- accessibility
  const name = el => {
    const al = el.getAttribute('aria-label'); if (al && al.trim()) return al.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) { const t = lb.split(/\\s+/).map(i => (document.getElementById(i) || {}).textContent || '').join(' ').trim(); if (t) return t; }
    if (el.localName === 'input' && ['button', 'submit', 'reset'].includes(el.type) && el.value) return el.value;
    if (el.labels && el.labels.length) { const t = [...el.labels].map(l => l.textContent).join(' ').trim(); if (t) return t; }
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim(); if (t) return t;
    const im = el.querySelector('img[alt]:not([alt=""])'); if (im) return im.alt;
    const st = el.querySelector('svg title'); if (st && st.textContent.trim()) return st.textContent.trim();
    return (el.getAttribute('title') || '').trim();
  };
  const live = sel => [...document.querySelectorAll(sel)].filter(e => !e.closest('[hidden],template'));
  const un = [];
  for (const b of live('button, [role="button"]')) if (!name(b)) un.push(path(b));
  if (un.length) add('a11y-name', 'fail', \`\${un.length} button(s) without an accessible name: \${take(un, 3)}\`);
  const ul = [];
  for (const a of live('a[href]')) if (!name(a)) ul.push(path(a));
  if (ul.length) add('a11y-name', 'fail', \`\${ul.length} link(s) without an accessible name: \${take(ul, 3)}\`);
  const ui = [];
  for (const i of live('input:not([type="hidden"]), select, textarea')) if (!name(i)) ui.push(path(i));
  if (ui.length) add('a11y-label', 'fail', \`\${ui.length} form control(s) without a label: \${take(ui, 3)}\`);
  const ni = [...document.querySelectorAll('img:not([alt])')].map(path);
  if (ni.length) add('a11y-alt', 'fail', \`\${ni.length} image(s) without alt: \${take(ni, 3)}\`);
  const ns = live('svg[role="img"], [role="img"]').filter(e => !name(e)).map(path);
  if (ns.length) add('a11y-name', 'fail', \`\${ns.length} role=img element(s) without a name: \${take(ns, 3)}\`);
  const nf = live('iframe').filter(e => !(e.title || '').trim()).map(path);
  if (nf.length) add('a11y-name', 'fail', \`iframe without a title: \${take(nf, 3)}\`);
  const nd = live('dialog').filter(e => !name(e)).map(path);
  if (nd.length) add('a11y-name', 'fail', \`dialog without a name: \${take(nd, 3)}\`);
  { const ids = new Map(), dup = [];
    for (const e of document.querySelectorAll('[id]')) { if (ids.has(e.id)) dup.push(e.id); else ids.set(e.id, 1); }
    if (dup.length) add('dup-id', 'fail', \`duplicate id: \${take([...new Set(dup)], 5)}\`); }
  { const miss = [];
    for (const e of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns],label[for]')) {
      for (const [at, lvl] of [['aria-labelledby', 'fail'], ['aria-describedby', 'fail'], ['aria-controls', 'warn'], ['aria-owns', 'warn'], ['for', 'fail']]) {
        const v = e.getAttribute(at); if (!v) continue;
        for (const id of v.split(/\\s+/)) if (id && !document.getElementById(id)) miss.push(\`\${at}="\${id}" on \${path(e)} [\${lvl}]\`);
      }
    }
    const f = miss.filter(x => x.endsWith('[fail]')), w = miss.filter(x => x.endsWith('[warn]'));
    if (f.length) add('aria-ref', 'fail', \`reference to a missing id: \${take(f.map(x => x.slice(0, -7)), 4)}\`);
    if (w.length) add('aria-ref', 'warn', \`reference to a missing id: \${take(w.map(x => x.slice(0, -7)), 4)}\`); }
  { const bad = [...document.querySelectorAll('[aria-hidden="true"] a[href], [aria-hidden="true"] button:not([disabled]), [aria-hidden="true"] input:not([disabled]):not([type="hidden"]), [aria-hidden="true"] select, [aria-hidden="true"] textarea, [aria-hidden="true"] [tabindex]:not([tabindex="-1"])')].filter(e => !e.closest('[hidden]')).map(path);
    if (bad.length) add('aria-hidden-focus', 'fail', \`focusable element inside aria-hidden: \${take(bad, 3)}\`); }
  { const bad = [...document.querySelectorAll('[tabindex]')].filter(e => +e.getAttribute('tabindex') > 0).map(path);
    if (bad.length) add('tabindex', 'warn', \`positive tabindex: \${take(bad, 3)}\`); }
  { const bad = live('details').filter(d => !d.querySelector(':scope > summary')).map(path);
    if (bad.length) add('a11y-structure', 'fail', \`<details> without <summary>: \${take(bad, 3)}\`); }
  { const bad = [...document.querySelectorAll('[onclick],[onchange],[oninput],[onload],[onerror],[onsubmit],[onkeydown]')].map(path);
    if (bad.length) add('inline-handler', 'fail', \`inline event handler attribute (CSP): \${take(bad, 3)}\`); }
  { const ROLES = new Set('alert alertdialog article banner button cell checkbox columnheader combobox complementary contentinfo definition dialog directory document figure form grid gridcell group heading img link list listbox listitem main marquee math menu menubar menuitem menuitemcheckbox menuitemradio navigation none note option presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status switch tab table tablist tabpanel term textbox timer toolbar tooltip tree treegrid treeitem generic meter paragraph caption mark'.split(' '));
    const bad = [...document.querySelectorAll('[role]')].filter(e => !e.getAttribute('role').split(/\\s+/).some(r => ROLES.has(r))).map(e => \`\${path(e)} role="\${e.getAttribute('role')}"\`);
    if (bad.length) add('a11y-role', 'warn', \`unknown ARIA role: \${take(bad, 3)}\`); }
  { const bad = live('a[target="_blank"]').filter(a => !/noopener/.test(a.rel || '')).map(a => a.getAttribute('href'));
    if (bad.length) add('rel-noopener', 'warn', \`target=_blank without rel=noopener: \${take(bad, 3)}\`); }
  { const bad = live('a[href]').filter(a => { const h = a.getAttribute('href'); return h === '' || h === '#'; }).map(path);
    if (bad.length) add('dead-link', 'warn', \`link with an empty target: \${take(bad, 3)}\`); }
  { const bad = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => i.getAttribute('src'));
    if (bad.length) add('img-broken', 'fail', \`image did not load: \${take(bad, 3)}\`); }
  { const tl = [];
    for (const l of document.querySelectorAll('[role="tablist"]')) {
      const tabs = [...l.querySelectorAll('[role="tab"]')];
      const sel = tabs.filter(t => t.getAttribute('aria-selected') === 'true');
      const tab0 = tabs.filter(t => t.tabIndex === 0);
      if (tabs.length && sel.length !== 1) tl.push(\`\${sel.length} selected tabs in \${path(l)}\`);
      if (tabs.length && tab0.length !== 1) tl.push(\`\${tab0.length} tabs in the Tab order in \${path(l)}\`);
      for (const t of tabs) { const p = document.getElementById(t.getAttribute('aria-controls') || ''); if (!p || p.getAttribute('role') !== 'tabpanel') tl.push(\`tab without a tabpanel in \${path(l)}\`); else if ((t.getAttribute('aria-selected') === 'true') === p.hidden) tl.push(\`panel state does not match its tab in \${path(l)}\`); }
    }
    if (tl.length) add('tabs', 'fail', take(tl, 3)); }
  { // tap targets (WCAG 2.5.8: 24 x 24 css px; exempt: inline links in running text, and a target whose 24 x 24 square touches no other target)
    const cands = [];
    for (const e of document.body.querySelectorAll('a[href], button, [role="tab"], [role="button"], select, summary, input:not([type="hidden"])')) {
      if (e.closest('[hidden],svg') || e.disabled) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || getComputedStyle(e).visibility === 'hidden') continue;
      cands.push({ e, r });
    }
    const small = [];
    for (const { e, r } of cands) {
      if (r.width >= 24 && r.height >= 24) continue;
      if (e.localName === 'a' && getComputedStyle(e).display === 'inline') continue;
      if (e.localName === 'input' && (e.type === 'checkbox' || e.type === 'radio') && e.labels && e.labels[0]) { const lr = e.labels[0].getBoundingClientRect(); if (lr.width >= 24 && lr.height >= 24) continue; }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const clash = cands.some(o => o.e !== e && !e.contains(o.e) && !o.e.contains(e) && o.r.left < cx + 12 && o.r.right > cx - 12 && o.r.top < cy + 12 && o.r.bottom > cy - 12);
      if (!clash) continue;
      small.push(\`\${path(e)} \${Math.round(r.width)}x\${Math.round(r.height)}\`);
    }
    if (small.length) add('target-size', 'warn', \`\${small.length} tap target(s) smaller than 24x24 with another target next to them: \${take(small, 3)}\`); }

  // ---- contrast of rendered text (colour against the first opaque background; gradients / images are skipped)
  { const parse = s => {
      let m = /rgba?\\(([^)]+)\\)/.exec(s);
      if (m) { const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
      m = /color\\(srgb ([\\d. ]+?)(?: \\/ ([\\d.]+))?\\)/.exec(s);
      if (m) { const p = m[1].trim().split(/\\s+/).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: m[2] != null ? +m[2] : 1 }; }
      return null; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    const memo = new WeakMap();
    const bgOf = el => {
      if (memo.has(el)) return memo.get(el);
      const layers = []; let base = null, unknown = false;
      for (let e = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.backgroundImage && s.backgroundImage !== 'none') { unknown = true; break; }
        const c = parse(s.backgroundColor);
        if (c && c.a > 0) { if (c.a >= 0.999) { base = c; break; } layers.push(c); }
      }
      let out = null;
      if (!unknown) { out = base || { r: 255, g: 255, b: 255, a: 1 }; for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out); }
      memo.set(el, out); return out;
    };
    const opacityOf = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
    const bad = new Map(), low = new Map();
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg,option,script,style,template,[hidden]') || el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      { let decor = false; for (let e = el; e && !decor; e = e.parentElement) decor = e.getAttribute('aria-hidden') === 'true' && getComputedStyle(e).pointerEvents === 'none'; if (decor) continue; }   // watermark-style overlays
      let has = false;
      for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim().length > 1) { has = true; break; }
      if (!has) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden') continue;
      const bg = bgOf(el), fg0 = parse(s.color);
      if (!bg || !fg0) continue;
      const op = opacityOf(el);
      if (op < 0.05) continue;
      const fg = over({ ...fg0, a: fg0.a * op }, bg);
      const l1 = lum(fg), l2 = lum(bg), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const fs = parseFloat(s.fontSize), large = fs >= 24 || (fs >= 18.66 && +s.fontWeight >= 700);
      const need = large ? 3 : 4.5;
      if (ratio >= need) continue;
      const key = \`\${hex(fg)} on \${hex(bg)}\${large ? ' (large)' : ''}\`;
      const tgt = ratio < 3 ? bad : low;
      const cur = tgt.get(key) || { n: 0, ratio, ex: \`"\${(el.textContent || '').trim().slice(0, 24)}" \${path(el)}\` };
      cur.n++; tgt.set(key, cur);
    }
    const fmt = m => [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([k, v]) => \`\${k} ratio \${v.ratio.toFixed(2)} x\${v.n}, e.g. \${v.ex}\`).join('; ');
    if (bad.size) add('contrast', 'fail', \`text below 3:1 contrast: \${fmt(bad)}\`);
    if (low.size) add('contrast', 'warn', \`text below the AA contrast (4.5:1 / 3:1 large): \${fmt(low)}\`);
  }
  { const tiny = [];
    for (const el of view.querySelectorAll('*')) {
      if (el.closest('svg,[hidden]')) continue;
      let has = false; for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim().length > 1) { has = true; break; }
      if (!has) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11 && isVis(el)) tiny.push(\`\${fs}px \${path(el)}\`);
    }
    if (tiny.length) add('tiny-text', 'warn', \`\${tiny.length} element(s) with text below 11px: \${take(tiny, 3)}\`); }

  // ---- contracts of the shared components
  const core = (await import('./js/data.js')).data.get('core');
  { const badKeys = [];
    for (const e of document.querySelectorAll('[data-src]')) for (const k of e.dataset.src.split(',').map(s => s.trim()).filter(Boolean)) if (core && core.sources && !Object.hasOwn(core.sources, k)) badKeys.push(\`"\${k}" on \${path(e)}\`);
    if (badKeys.length) add('src-key', 'fail', \`source key is not in core.sources: \${take(badKeys, 4)}\`);
    const badP = [];
    for (const e of document.querySelectorAll('[data-pending-id]')) if (core && core.pending && !Object.hasOwn(core.pending, e.dataset.pendingId)) badP.push(\`"\${e.dataset.pendingId}"\`);
    if (badP.length) add('pending-id', 'fail', \`pending id is not in core.pending: \${take(badP, 4)}\`); }
  { const g = await import('./js/glossary.js');
    const links = [...document.querySelectorAll('a[data-gl]')];
    info.gl = links.length;
    if (links.length) { try { await g.ready(); const bad = links.filter(a => !g.termOf(a.dataset.gl)).map(a => a.dataset.gl); if (bad.length) add('gl-term', 'fail', \`glossary term does not exist: \${take([...new Set(bad)], 5)}\`); } catch (e) { add('gl-term', 'warn', \`glossary data is not available: \${e.message}\`); } } }
  { const sh = await import('./js/share.js');
    const bad = [...document.querySelectorAll('[data-share]')].filter(b => !sh.get(b.dataset.share)).map(b => b.dataset.share);
    if (bad.length) add('share-id', 'fail', \`share button without a registered spec: \${take(bad, 4)}\`);
    info.share = [];
    for (const [id, s] of sh.all()) { let emb = null; try { emb = s.embed ? sh.embedHash(s) : null; } catch { emb = null; } info.share.push({ id, mock: !!sh.isMock(s), embed: emb }); } }
  { const figs = [...view.querySelectorAll('figure.fig')];
    const noTable = figs.filter(f => !f.querySelector('details.fig-table, table')).map(path);
    if (noTable.length) add('fig-table', 'warn', \`chart without a data table alternative: \${take(noTable, 3)}\`);
    const mockNoBadge = figs.filter(f => f.dataset.mockFig === 'true' && !f.querySelector('.mock-badge')).map(path);
    if (mockNoBadge.length) add('mock-marker', 'fail', \`mock figure without the mock badge: \${take(mockNoBadge, 3)}\`);
    const blocks = [...view.querySelectorAll('section.block')];
    const noSt = blocks.filter(b => !b.dataset.blockStatus).map(path);
    if (noSt.length) add('block-status', 'warn', \`block without data-block-status: \${take(noSt, 3)}\`);
    const textData = blocks.filter(b => b.dataset.blockStatus === 'text' && b.querySelector('figure.fig, table, .kpi, .val, [data-src]')).map(path);
    if (textData.length) add('block-text', 'fail', \`a block marked as text shows data (a chart, a table, a KPI or a sourced number): \${take(textData, 3)}\`);
    info.blocks = blocks.length; info.mockBlocks = blocks.filter(b => b.dataset.blockMock === 'true').length; }
  const charts = [...document.querySelectorAll('.chart')];
  info.charts = charts.length;
  for (const c of charts) {
    const r = c.dataset.ready, v = isVis(c);
    if (r === 'err') add('chart', 'fail', \`a chart failed to draw: \${path(c)}\`);
    else if (v && r !== '1') add('chart', 'fail', \`a visible chart never became ready (data-ready=\${r}): \${path(c)}\`);
    else if (!v && r !== '1' && o.deep) add('chart', 'warn', \`a chart never drew, even after opening every tab and <details>: \${path(c)}\`);
    else if (v) { const n = c.querySelectorAll('svg path, svg rect, svg circle, svg line, svg polygon').length; if (n < 2) add('chart', 'warn', \`a chart is empty: \${path(c)}\`); }
    if (c.getAttribute('role') === 'img' && !(c.getAttribute('aria-label') || '').trim()) add('a11y-name', 'fail', \`chart without an aria-label: \${path(c)}\`);
  }
  info.tabs = [...document.querySelectorAll('.tabs')].map(t => ({ id: t.id, qkey: t.dataset.qkey || '', keys: [...t.querySelectorAll(':scope > .tab-list [role="tab"]')].map(x => x.dataset.key) }));
  info.hasDetails = document.querySelectorAll('details').length;

  // ---- "Следва" card and every internal link
  const meta = (window.__ROUTES__ || []).find(r => r.id === rid);
  const nx = view.querySelector('article.page aside.next');
  if (nx) {
    const ls = [...nx.querySelectorAll('a[href]')];
    if (!ls.length) add('next', 'fail', 'the „Следва“ card has no link');
    for (const a of ls) if (!resolves(a.getAttribute('href'))) add('next', 'fail', \`the „Следва“ link does not lead to a screen: \${a.getAttribute('href')}\`);
    if (meta && !meta.next.length) add('next', 'warn', 'a „Следва“ card on a screen that declares none');
  } else if (meta && meta.next.length && info.view === 'ready') add('next', 'warn', 'no „Следва“ card on a screen that declares one');
  const hashes = new Set(), ext = new Set(), rel = new Set(), badLinks = [];
  for (const a of document.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href');
    if (h.startsWith('#/')) { hashes.add(h); if (!resolves(h)) badLinks.push(\`\${h} (\${path(a)})\`); }
    else if (/^https?:/i.test(h)) ext.add(h);
    else if (/^(javascript|data):/i.test(h)) badLinks.push(\`\${h.slice(0, 40)} (\${path(a)})\`);
    else if (!h.startsWith('#') && !/^(mailto|tel):/i.test(h)) rel.add(h);
  }
  if (badLinks.length) add('link-route', 'fail', \`internal link to no screen: \${take(badLinks, 4)}\`);
  info.links = [...hashes]; info.ext = [...ext]; info.rel = [...rel];
  const k = window.__chk || { csp: [], rej: [] };
  if (k.csp.length) add('csp', 'fail', \`CSP violation: \${take(k.csp, 3)}\`);
  if (k.rej.length) add('rejection', 'fail', \`unhandled promise rejection: \${take(k.rej, 2)}\`);
  info.nodes = document.querySelectorAll('*').length;
  return { problems: P, info };
}
`;

export const CLEAR_JS = `(kv) => { try { localStorage.clear(); sessionStorage.clear(); for (const [k, v] of Object.entries(kv || {})) localStorage.setItem(k, v); } catch (e) {} }`;

export const DIAG_JS = `() => {
  const v = document.getElementById('view'), a = v && v.querySelector('article.page');
  return a ? \`view=\${a.dataset.view} ready=\${a.dataset.ready} route=\${a.dataset.route}\` : 'no article.page; #view text: ' + ((v && v.textContent) || '').trim().slice(0, 140);
}`;

export const DISCOVER_JS = `async () => {
  const s = await import('./js/store.js');
  return { routes: window.__ROUTES__ || null, periods: s.PERIODS.map(p => p.key), users: s.USER_TYPES.map(u => u.id), defaultPeriod: s.DEFAULT_PERIOD };
}`;

export const SELFTEST_JS = `() => {
  const host = document.querySelector('#view article.page') || document.body;
  const add = h => { const d = document.createElement('div'); d.innerHTML = h; host.appendChild(d); };
  add('<p>NaN</p>');
  add('<div data-x="null"></div>');
  add('<div style="width:3000px;height:4px"></div>');
  add('<button></button>');
  add('<a href="#/nema-takava-stranica-xyz">nowhere</a>');
  add('<i id="dupx"></i><i id="dupx"></i>');
  add('<p style="color:#cccccc;background:#ffffff">low contrast text here</p>');
  add('<div class="chart" role="img" aria-label="x" data-ready="0" style="width:200px;height:100px"></div>');
  add('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">');
  add('<span data-src="no-such-source-key">s</span>');
  add('<a data-gl="no-such-term-xyz" href="#/rechnik">t</a>');
  add('<h1>second heading</h1>');
  add('<p>lorem ipsum dolor</p>');
  add('<input type="text">');
  add('<p>private channel</p>');
  add('<p>this is certainly english text</p>');
  add('<p style="font-size:9px">tiny text sample</p>');
  add('<button aria-label="a" style="width:10px;height:10px;display:inline-block;padding:0"></button><button aria-label="b" style="width:10px;height:10px;display:inline-block;padding:0"></button>');
  console.error('selftest console error');
  setTimeout(() => { throw new Error('selftest exception'); }, 0);
  setTimeout(() => { alert('selftest dialog'); }, 0);
  fetch('/selftest-missing.txt').catch(() => {});
  fetch('/data/selftest-missing.json').catch(() => {});
  fetch('http://selftest.invalid/x').catch(() => {});
  document.cookie = 'selftest=1';
}`;

export const AXE_JS = `async () => {
  const r = await window.axe.run(document, { resultTypes: ['violations'] });
  return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, t: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }));
}`;
