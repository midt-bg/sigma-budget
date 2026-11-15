import { evaluateProbe } from '../helpers.ts';
import { test, expect } from '../fixtures.ts';
import { GRID_JS, TARGET_JS, OVERFLOW_JS, FOCUS_JS, ROUTES } from '../accept-probes.ts';
import { plan, compare, cum, val } from '../expected.ts';
test.use({
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
});
const rows = [
  ['rev', 'Приходи'],
  ['exp.total', 'Разходи'],
  ['balance', 'Салдо'],
] as const;
function number(s: string) {
  const m = s
    .replaceAll('−', '-')
    .replace(/[  ]/g, ' ')
    .match(/[-+]?\d[\d ]*(?:,\d+)?/);
  return m ? Number(m[0].replaceAll(' ', '').replace(',', '.')) : null;
}
test('acceptance numbers from independent release data', async ({ context, page, siteURL }) => {
  test.setTimeout(180_000);
  await context.addInitScript('window.__HASH_ROUTES__ = true');
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => errors.push('EXC ' + String(e).slice(0, 160)));
  const base = siteURL + '/index.html';
  await page.goto(base + '#/');
  await page.waitForSelector('#s15-b-plan .s15-plan-row', { timeout: 8000 });
  const home = (await page.locator('#s15-b-plan').innerText()).replace(/[   ]/g, ' '),
    P = plan(),
    Q = compare();
  for (const s of [...P.sums, ...P.cur]) expect.soft(home, 'home plan ' + s).toContain(s);
  await page.goto(base + '#/izpalnenie');
  await page.waitForSelector('table.data', { timeout: 8000 });
  await page.waitForTimeout(300);
  const txt = (
    await page.locator('main, #main, body').evaluateAll((els) => (els[0] as HTMLElement).innerText)
  )
    .replace(/[  ]/g, ' ')
    .replaceAll('−', '-');
  for (const s of [...Q.prev, ...Q.cur, ...Q.diff, Q.balanceDiff])
    expect.soft(txt, 'comparison reference ' + s).toContain(s.replaceAll('−', '-'));
  expect.soft(txt).toContain('дефицит');
  expect.soft(txt).not.toMatch(/-\d+[,.]\d+ ?млрд\. €, [+-]?\d/);
  for (const [g1, g2] of [
    [2025, 2026],
    [2024, 2025],
    [2024, 2026],
  ] as const)
    for (const scope of ['kfp', 'nat', 'eu'])
      for (const [month, mode] of [
        [g2 === 2026 ? 8 : 12, 'kum'],
        [g2 === 2026 ? 8 : 12, 'mesec'],
        [1, 'kum'],
        [1, 'mesec'],
        [5, 'kum'],
        [5, 'mesec'],
      ] as const) {
        const q = `?g1=${g1}&g2=${g2}&mesec=${month}&obhvat=${scope}&rez=${mode}`;
        await test.step(q, async () => {
          await page.goto(base + '#/izpalnenie' + q);
          await page.waitForSelector('#s15-t-grid', { timeout: 8000 });
          await page.waitForTimeout(120);
          const grid: Record<string, string[]> | null = await evaluateProbe(page, GRID_JS);
          expect.soft(Boolean(grid), q + ': table').toBe(true);
          if (!grid) return;
          for (const [row, label] of rows) {
            const key = Object.keys(grid).find((k) => k.startsWith(label));
            expect.soft(Boolean(key), q + ': row ' + label).toBe(true);
            if (!key) continue;
            const got = grid[key]!.slice(1, 4).map(number),
              want1 = val(g1, scope, row, month, mode) / 1000,
              want2 = val(g2, scope, row, month, mode) / 1000;
            expect
              .soft(
                got[0] !== null && Math.abs(got[0]! - want1) <= 0.0051,
                q + ' ' + label + ' ' + g1,
              )
              .toBe(true);
            expect
              .soft(
                got[1] !== null && Math.abs(got[1]! - want2) <= 0.0051,
                q + ' ' + label + ' ' + g2,
              )
              .toBe(true);
            if (got[2] !== null)
              expect
                .soft(Math.abs(got[2]! - (want2 - want1)), q + ' ' + label + ' difference')
                .toBeLessThanOrEqual(0.0101);
          }
          if (mode === 'mesec' && month > 1)
            for (const [row] of rows.slice(0, 2))
              expect
                .soft(
                  Math.abs(
                    val(g2, scope, row, month, 'mesec') -
                      (cum(g2, scope, row, month) - cum(g2, scope, row, month - 1)),
                  ),
                  q + ': adjacent reports ' + row,
                )
                .toBeLessThan(1e-9);
        });
      }
  for (const [g, row, want] of [
    [2025, 'rev', 26.925],
    [2026, 'rev', 30.118],
    [2025, 'exp.total', 29.592],
    [2026, 'exp.total', 33.193],
    [2025, 'balance', -2.666],
    [2026, 'balance', -3.075],
  ] as const)
    expect
      .soft(Math.abs(cum(g, 'kfp', row, 8) / 1000 - want), `brief cumulative ${g} ${row}`)
      .toBeLessThan(0.0006);
  for (const [g, row, want] of [
    [2025, 'rev', 3.223],
    [2026, 'rev', 3.77],
    [2025, 'exp.total', 3.702],
    [2026, 'exp.total', 4.644],
    [2025, 'balance', -0.479],
    [2026, 'balance', -0.874],
  ] as const)
    expect
      .soft(Math.abs(val(g, 'kfp', row, 8, 'mesec') / 1000 - want), `brief monthly ${g} ${row}`)
      .toBeLessThan(0.0006);
  expect.soft(errors).toEqual([]);
});
for (const w of [1280, 768, 640, 390, 360, 320])
  test(`acceptance layout ${w}`, async ({ browser, siteURL }) => {
    test.setTimeout(120_000);
    const touch = w <= 768;
    const ctx = await browser.newContext({
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
      hasTouch: touch,
      isMobile: false,
      viewport: { width: w, height: w >= 700 ? 900 : 800 },
    });
    try {
      await ctx.addInitScript('window.__HASH_ROUTES__ = true');
      const page = await ctx.newPage(),
        errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 160));
      });
      page.on('pageerror', (e) => errors.push('EXC ' + String(e).slice(0, 160)));
      for (const [name, h] of ROUTES)
        await test.step(name!, async () => {
          await page.goto(siteURL + '/index.html' + h);
          // As in Python, layout is measured even after a heading wait failure.
          try {
            await page.waitForSelector('h1', { timeout: 8000 });
          } catch {}
          await page.waitForTimeout(500);
          const o = await evaluateProbe<{ page: number; wide: string[]; gridOver: number }>(
            page,
            OVERFLOW_JS,
          );
          expect.soft(o.page, name + ': page overflow').toBeLessThanOrEqual(0);
          expect.soft(o.wide, name + ': content overflow').toEqual([]);
          expect.soft(o.gridOver, name + ': grid overflow').toBeLessThanOrEqual(0);
          const missing = await evaluateProbe(
            page,
            `() => [...document.querySelectorAll('figure .chart, .chart[data-ready="1"]')].filter(c => {const f=c.closest('figure, section.block');return f&&!f.querySelector('table, details.fig-table, [data-attach]');}).map(c=>c.id||c.className).slice(0,3)`,
          );
          expect.soft(missing, name + ': chart table twins').toEqual([]);
          if (touch && [390, 768].includes(w))
            expect.soft(await evaluateProbe(page, TARGET_JS), name + ': touch targets').toEqual([]);
        });
      expect.soft(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
for (const w of [1280, 390])
  test(`acceptance keyboard ${w}`, async ({ browser, siteURL }) => {
    const ctx = await browser.newContext({
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
      viewport: { width: w, height: w >= 700 ? 900 : 800 },
    });
    try {
      await ctx.addInitScript('window.__HASH_ROUTES__ = true');
      const page = await ctx.newPage();
      for (const [name, h] of [
        ['home', '#/'],
        ['izpalnenie', '#/izpalnenie'],
        ['danaci', '#/danaci'],
        ['razhodi', '#/razhodi'],
        ['tarsene', '#/tarsene'],
      ] as const) {
        await page.goto(siteURL + '/index.html' + h);
        await page.waitForSelector('h1', { timeout: 8000 });
        await page.waitForTimeout(500);
        const stops: { n: string; ring: boolean; back: boolean; tag: string }[] = [];
        let back = 0;
        const noring: string[] = [];
        for (let i = 0; i < 60; i++) {
          await page.keyboard.press('Tab');
          const f = await evaluateProbe<{
            n: string;
            ring: boolean;
            back: boolean;
            tag: string;
          } | null>(page, FOCUS_JS);
          if (!f || f.tag === 'body') break;
          stops.push(f);
          if (!f.ring) noring.push(f.n);
          if (f.back && i > 0) back++;
        }
        expect.soft(stops.length, name + ': tab stops').toBeGreaterThanOrEqual(8);
        expect.soft(noring, name + ': visible focus').toEqual([]);
        expect.soft(back, name + ': DOM order').toBe(0);
        expect
          .soft(
            stops.filter((s) => !s.n),
            name + ': text names',
          )
          .toEqual([]);
      }
    } finally {
      await ctx.close();
    }
  });
test('retired dependencies and official replacements', async ({ browser, siteURL }) => {
  // Original retired_examples used a default context: 1280 × 720, motion allowed.
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'no-preference',
  });
  try {
    const page = await context.newPage();
    await context.addInitScript('window.__HASH_ROUTES__ = true');
    await page.goto(siteURL + '/index.html#/razhodi/obrazovanie?per=2026.expected');
    await page.waitForSelector('#s08-godini');
    expect.soft(await page.locator('#s08-merki').count()).toBe(0);
    const result: Record<string, string[]> = await evaluateProbe(
      page,
      `async()=>{
    const s08=await import('./js/pages/s08-funkciya.js'),s12=await import('./js/pages/s12-merki.js'),s18=await import('./js/pages/s18-danaci.js');
    const b=typeof s12.needs==='function'?[...new Set(['2026.law','2027.draft','2028.forecast','2029.forecast'].flatMap(key=>s12.needs({period:{key}})))]:s12.needs;
    return {a:s08.needs,b,c:s18.needs};
  }`,
    );
    expect
      .soft(
        !result.a!.includes('measures?') &&
          Object.values(result)
            .flat()
            .every((v) => !v.includes('mock/')),
        'no retired dependencies',
      )
      .toBe(true);
    expect
      .soft(
        result.b!.includes('measures') &&
          result.b!.includes('budget2027?') &&
          result.c!.includes('indirect-tax-parameters?'),
        'official replacements',
      )
      .toBe(true);
  } finally {
    await context.close();
  }
});
