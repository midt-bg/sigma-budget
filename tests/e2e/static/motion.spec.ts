import { evaluateProbe } from '../helpers.ts';
import { test, expect } from '../fixtures.ts';
import { CLS_JS, RUNNING, OBSERVERS_JS } from '../motion-probes.ts';
import { plan } from '../expected.ts';
import type { Browser } from '@playwright/test';
test.use({ serviceWorkers: 'block' });
const PLAN = plan();
async function context(browser: Browser, w: number, reduce: boolean) {
  const c = await browser.newContext({
    serviceWorkers: 'block',
    hasTouch: w < 700,
    reducedMotion: reduce ? 'reduce' : 'no-preference',
    viewport: { width: w, height: w >= 700 ? 900 : 844 },
  });
  await c.addInitScript('window.__HASH_ROUTES__ = true');
  return c;
}
const texts = "[...document.querySelectorAll('#s15-b-plan .prog-text')].map(e=>e.textContent)";
test('reduced motion final state', async ({ browser, siteURL }) => {
  const c = await context(browser, 1280, true);
  try {
    const pg = await c.newPage();
    await pg.goto(siteURL + '/index.html#/');
    await pg.waitForSelector('#s15-b-plan .prog-text');
    await pg.waitForTimeout(150);
    expect
      .soft(await evaluateProbe(pg, "document.documentElement.classList.contains('mo')"))
      .toBe(false);
    expect
      .soft(
        await evaluateProbe(
          pg,
          "document.querySelectorAll('[data-rv],[data-pg],.enter-anim').length",
        ),
      )
      .toBe(0);
    expect.soft(await evaluateProbe(pg, RUNNING)).toBe(0);
    expect
      .soft(
        await evaluateProbe(
          pg,
          "[...document.querySelectorAll('#s15-b-plan .s15-prog-cur .prog-text')].map(e=>e.textContent)",
        ),
      )
      .toEqual(PLAN.cur);
    expect
      .soft(
        await evaluateProbe(
          pg,
          "[...document.querySelectorAll('.prog-fill')].every(f=>getComputedStyle(f).transform==='none')",
        ),
      )
      .toBe(true);
  } finally {
    await c.close();
  }
});
test('motion entrance, counting, settle, scroll reveal and dropdowns', async ({
  browser,
  siteURL,
}) => {
  const c = await context(browser, 1280, false);
  try {
    const pg = await c.newPage(),
      U = siteURL + '/index.html';
    await pg.goto(U + '#/');
    await pg.waitForSelector('h1');
    await pg.waitForTimeout(40);
    expect
      .soft(await evaluateProbe(pg, "document.documentElement.classList.contains('mo')"))
      .toBe(true);
    expect.soft(await evaluateProbe(pg, RUNNING), 'entrance animates').toBeGreaterThan(0);
    const seen: unknown[] = [];
    for (let i = 0; i < 40; i++) {
      seen.push(
        await evaluateProbe(
          pg,
          "(document.querySelector('#s15-b-plan .s15-prog-cur .prog-text')||{}).textContent",
        ),
      );
      await pg.waitForTimeout(50);
    }
    expect.soft(new Set(seen).size, `counting samples ${[...new Set(seen)]}`).toBeGreaterThan(2);
    await pg.waitForTimeout(900);
    expect.soft(await evaluateProbe(pg, texts), 'final percentages').toEqual(PLAN.bars);
    expect
      .soft(
        await evaluateProbe(
          pg,
          "[...document.querySelectorAll('.prog-fill')].every(f=>getComputedStyle(f).transform==='none'&&!f.hasAttribute('data-pg'))",
        ),
        'final bars',
      )
      .toBe(true);
    expect
      .soft(
        await evaluateProbe(
          pg,
          "[...document.querySelectorAll('#s15-b-plan .prog-fill')].map(f=>f.style.width).join()",
        ),
        'bar widths',
      )
      .toBe(PLAN.widths.join());
    expect.soft(await evaluateProbe(pg, RUNNING), 'animations finish').toBe(0);
    expect
      .soft(
        await evaluateProbe(
          pg,
          "[...document.querySelectorAll('#s15-b-plan .prog-text')].every(e=>!e.style.minWidth&&!e.style.display)",
        ),
        'counting styles released',
      )
      .toBe(true);
    await pg.goto(U + '?s=1#/');
    await pg.waitForSelector('#s15-b-plan .prog-text');
    await pg.waitForTimeout(250);
    const mid = await evaluateProbe(
      pg,
      "document.querySelector('#s15-b-plan .s15-prog-cur .prog-text').textContent",
    );
    const fin = await evaluateProbe(
      pg,
      "async()=>{(await import('./js/ui/motion.js')).settle();return [...document.querySelectorAll('#s15-b-plan .prog-text')].map(e=>e.textContent).join();}",
    );
    expect.soft(fin, 'settle after ' + mid).toBe(PLAN.bars.join());
    await pg.goto(U + '#/izpalnenie');
    await pg.waitForSelector('#s15-b-plan');
    await pg.waitForTimeout(1200);
    const hid: [string, string][] = await evaluateProbe(
      pg,
      "[...document.querySelectorAll('.page-body > [data-rv]')].map(e=>[e.id||e.className.split(' ')[0],getComputedStyle(e).opacity])",
    );
    expect
      .soft(
        hid.length >= 1 && hid.every(([, o]) => Number(o) < 0.05),
        'below fold waits ' + JSON.stringify(hid),
      )
      .toBe(true);
    await evaluateProbe(pg, 'window.scrollTo(0,document.body.scrollHeight)');
    await pg.waitForTimeout(1000);
    expect
      .soft(await evaluateProbe(pg, "document.querySelectorAll('.page-body > [data-rv]').length"))
      .toBe(0);
    expect
      .soft(
        await evaluateProbe(
          pg,
          "[...document.querySelectorAll('.page-body > *')].every(e=>getComputedStyle(e).opacity==='1')",
        ),
      )
      .toBe(true);
    await pg.goto(U + '#/prihodi');
    await pg.waitForSelector('h1');
    await pg.waitForTimeout(1200);
    await evaluateProbe(pg, 'window.scrollTo(0,0)');
    const tgt: string | null = await evaluateProbe(
      pg,
      "(()=>{const e=document.querySelector('.page-body > [data-rv] a, .page-body > [data-rv] button');if(!e)return null;e.id=e.id||'mo-probe';return e.id;})()",
    );
    // Same conditional probe as Python: focus only if a below-fold interactive target exists.
    if (tgt) {
      await pg.focus('#' + tgt);
      await pg.waitForTimeout(700);
      expect
        .soft(
          await evaluateProbe(
            pg,
            "id=>getComputedStyle(document.getElementById(id).closest('.page-body > *')).opacity",
            tgt,
          ),
          'focus reveals',
        )
        .toBe('1');
    }
    await pg.goto(U + '#/razhodi');
    await pg.waitForSelector('h1');
    await pg.waitForTimeout(800);
    await pg.click('#sidenav .nav-main[data-grp="2"]');
    await pg.waitForTimeout(60);
    expect
      .soft(
        await evaluateProbe(pg, "document.getAnimations().some(a=>a.animationName==='mo-drop')"),
        'dropdown opening animation',
      )
      .toBe(true);
    await pg.keyboard.press('Escape');
    await pg.waitForTimeout(40);
    expect
      .soft(
        await evaluateProbe(pg, "!!document.querySelector('.popover[data-closing]')"),
        'dropdown closing',
      )
      .toBe(true);
    await pg.waitForTimeout(400);
    expect.soft(await evaluateProbe(pg, "document.querySelectorAll('.popover').length")).toBe(0);
    expect
      .soft(
        await evaluateProbe(pg, "document.activeElement.classList.contains('nav-main')"),
        'dropdown focus',
      )
      .toBe(true);
    await pg.click('#btn-search');
    await pg.waitForTimeout(60);
    expect
      .soft(
        await evaluateProbe(pg, "document.getAnimations().some(a=>a.animationName==='mo-drop')"),
        'search animation',
      )
      .toBe(true);
  } finally {
    await c.close();
  }
});
test('SPA navigation releases removed observer targets', async ({ browser, siteURL }) => {
  const c = await context(browser, 1280, false);
  try {
    await c.addInitScript(OBSERVERS_JS);
    const pg = await c.newPage();
    await pg.goto(siteURL + '/index.html#/prihodi');
    for (const [route, screen] of [
      ['#/prihodi', 'S06'],
      ['#/razhodi', 'S07'],
      ['#/izpalnenie', 'S15'],
      ['#/prihodi', 'S06'],
    ] as const) {
      await evaluateProbe(pg, 'h=>{location.hash=h;}', route);
      await pg.waitForSelector(`article[data-route="${screen}"][data-ready="1"]`, {
        timeout: 8000,
      });
      await pg.waitForTimeout(900);
      const observed: boolean[] = await evaluateProbe(
        pg,
        '()=>window.__motionObservers.flatMap(o=>[...o.targets]).map(el=>el.isConnected)',
      );
      expect.soft(observed.length, route + ': lifecycle exercised').toBeGreaterThan(0);
      expect.soft(observed.every(Boolean), route + ': removed targets released').toBe(true);
    }
  } finally {
    await c.close();
  }
});
for (const w of [1280, 390, 320])
  for (const route of ['#/', '#/izpalnenie', '#/razhodi', '#/prihodi', '#/vedomstva', '#/5-minuti'])
    test(`motion CLS and entrance overflow ${w} ${route}`, async ({ browser, siteURL }) => {
      const vals: number[] = [];
      for (const red of [true, false]) {
        const c = await context(browser, w, red);
        try {
          const pg = await c.newPage(),
            cdp = await c.newCDPSession(pg);
          if (!red && w === 320) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
          await pg.addInitScript('(' + CLS_JS + ')()');
          const over: number[] = [];
          await pg.goto(siteURL + '/index.html' + route);
          await pg.waitForSelector('h1');
          for (let i = 0; i < 12; i++) {
            over.push(await evaluateProbe(pg, 'document.documentElement.scrollWidth-innerWidth'));
            await pg.waitForTimeout(120);
          }
          await pg.waitForTimeout(1500);
          vals.push(await evaluateProbe(pg, 'window.__cls'));
          if (!red) {
            expect.soft(Math.max(...over), 'entrance overflow').toBeLessThanOrEqual(0);
            if (['#/', '#/izpalnenie'].includes(route))
              expect
                .soft(await evaluateProbe(pg, texts), 'throttled final numbers')
                .toEqual(PLAN.bars);
          }
        } finally {
          await c.close();
        }
      }
      expect
        .soft(vals[1]!, `CLS motion ${vals[1]} vs reduced ${vals[0]}`)
        .toBeLessThanOrEqual(vals[0]! + 0.01);
    });
