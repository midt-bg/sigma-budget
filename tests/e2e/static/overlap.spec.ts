import { evaluateProbe } from '../helpers.ts';
import { test, expect } from '../fixtures.ts';
import { LAYOUT_JS } from '../overlap-probes.ts';
import type { BrowserContext } from '@playwright/test';
// Python's discovery browser.new_page() allows service workers; matrix contexts block them.
test.use({ serviceWorkers: 'allow' });
test('overlap quick: all routes, sticky positions, print and extra samples', async ({
  browser,
  page,
  siteURL,
}) => {
  test.setTimeout(600_000);
  const base = siteURL + '/index.html';
  await page.addInitScript('window.__HASH_ROUTES__ = true');
  await page.goto(base);
  await page.waitForTimeout(800);
  const routes: { id: string; bare?: boolean; samples: string[] }[] = (
    await evaluateProbe<{ id: string; bare?: boolean; samples: string[] }[]>(
      page,
      'window.__ROUTES__',
    )
  ).filter((r: { bare?: boolean }) => !r.bare);
  await page.close();
  for (const r of routes) if (!r.samples.length) r.samples = ['#/nyama-takava-stranitsa'];
  const ctx = async (w: number) => {
    const c = await browser.newContext({
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
      hasTouch: w < 700,
      viewport: { width: w, height: w >= 700 ? 900 : 844 },
    });
    await c.addInitScript('window.__HASH_ROUTES__ = true');
    return c;
  };
  const load = async (c: BrowserContext, h: string, errors: string[]) => {
    const pg = await c.newPage();
    pg.on('console', (m) => {
      if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140));
    });
    pg.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 140)));
    pg.on('requestfailed', (r) => errors.push('request: ' + r.url().slice(-60)));
    await pg.goto(base + h);
    try {
      await pg.waitForSelector("article.page[data-ready='1']", { timeout: 9000 });
    } catch {
      errors.push('the screen never became ready');
    }
    await pg.waitForTimeout(350);
    return pg;
  };
  for (const w of [1440, 1241, 390]) {
    const c = await ctx(w);
    try {
      for (const r of routes)
        await test.step(`${w} ${r.id}`, async () => {
          const errors: string[] = [],
            pg = await load(c, r.samples[0]!, errors);
          try {
            expect.soft(await evaluateProbe(pg, LAYOUT_JS), `${w} ${r.id}: banner`).toEqual([]);
            expect.soft(errors, `${w} ${r.id}: errors`).toEqual([]);
            for (const frac of w === 390 ? [0.33, 0.66, 1] : [1]) {
              await evaluateProbe(
                pg,
                'f=>window.scrollTo(0,(document.body.scrollHeight-innerHeight)*f)',
                frac,
              );
              await pg.waitForTimeout(140);
              const findings: { k: string; m: string }[] = await evaluateProbe(pg, LAYOUT_JS);
              expect
                .soft(
                  findings.filter((f) => ['overlap', 'outside'].includes(f.k)),
                  `${w} ${r.id}: scroll ${frac}`,
                )
                .toEqual([]);
            }
            const under = await evaluateProbe(
              pg,
              `(()=>{const t=document.getElementById('tabbar');if(!t||getComputedStyle(t).display==='none')return null;const top=t.getBoundingClientRect().top;const bad=[...document.querySelectorAll('#footer a,#footer button,#footer summary')].filter(e=>{const d=e.closest('details');if(d&&!d.open&&!e.matches('summary'))return false;return e.getBoundingClientRect().bottom>top+1&&e.getBoundingClientRect().height>2;});return bad.length?bad[0].textContent.trim().slice(0,24):null;})()`,
            );
            expect.soft(under, `${w} ${r.id}: under tabbar`).toBeNull();
            if (w === 390) {
              await pg.emulateMedia({ media: 'print' });
              await pg.waitForTimeout(120);
              const ph = await evaluateProbe<[number, boolean]>(
                pg,
                '[document.documentElement.scrollWidth-document.documentElement.clientWidth,!!document.querySelector("h1")&&document.querySelector("h1").getBoundingClientRect().height>0]',
              );
              expect.soft(ph[0], r.id + ': print overflow').toBeLessThanOrEqual(1);
              expect.soft(ph[1], r.id + ': print heading').toBe(true);
            }
          } finally {
            await pg.close();
          }
        });
    } finally {
      await c.close();
    }
  }
  const c = await ctx(1280);
  try {
    for (const r of routes)
      for (const h of r.samples.slice(1))
        await test.step(r.id + ' ' + h, async () => {
          const errors: string[] = [],
            pg = await load(c, h, errors);
          try {
            expect.soft(errors, h + ': errors').toEqual([]);
            const findings: { k: string; m: string }[] = await evaluateProbe(pg, LAYOUT_JS);
            expect
              .soft(
                findings.filter((f) => ['overlap', 'hscroll'].includes(f.k)),
                h,
              )
              .toEqual([]);
          } finally {
            await pg.close();
          }
        });
  } finally {
    await c.close();
  }
});
