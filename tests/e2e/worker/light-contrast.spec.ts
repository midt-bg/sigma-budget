import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '../fixtures.ts';
import { CONTRAST_JS, CONTROL_HTML, deepPass } from '../contrast-probes.ts';

// Python check_probe_thresholds used the default allow; the route sweep blocked SW.
test.use({ serviceWorkers: 'allow', colorScheme: 'light' });
type Probe = {
  texts: number;
  fields: number;
  placeholders: number;
  boundaries: number;
  low: { txt: string }[];
  ph: { who: string }[];
  border: { who: string }[];
};
test('contrast probe positive and negative threshold controls', async ({ page }) => {
  await page.setContent(CONTROL_HTML);
  const result = await page.evaluate<Probe>(`(${CONTRAST_JS})()`);
  expect(result.low.map((item) => item.txt).sort(), '4.5 small / 3 large text').toEqual([
    'large-fail',
    'small-fail',
  ]);
  expect(
    result.ph.map((item) => item.who),
    '4.5 placeholder',
  ).toEqual(['bad-field']);
  expect(
    result.border.map((item) => item.who),
    '3 field boundary',
  ).toEqual(['bad-field']);
});

test('light contrast all non-bare routes at 1280 and 400 px', async ({ browser, siteURL }) => {
  // A deep pass can take several seconds per route, as in the original sequential sweep.
  test.setTimeout(900_000);
  const records: (Probe & { route: string; path: string; width: number })[] = [];
  const failures: unknown[] = [];
  for (const [width, height] of [
    [1280, 900],
    [400, 800],
  ]) {
    const context = await browser.newContext({
      viewport: { width: width!, height: height! },
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    context.setDefaultTimeout(30_000);
    context.setDefaultNavigationTimeout(30_000);
    try {
      const page = await context.newPage();
      await page.goto(siteURL + '/');
      await page.locator('article[data-ready="1"]').waitFor();
      const routes =
        await page.evaluate<{ id: string; bare?: boolean; samples?: string[] }[]>(
          'window.__ROUTES__',
        );
      expect(routes.length, 'route discovery must not be empty').toBeGreaterThan(0);
      const included = routes.filter((route) => !route.bare);
      expect(included.length, 'non-bare route discovery must not be empty').toBeGreaterThan(0);
      for (const route of included) {
        const path = (route.samples?.length ? route.samples[0]! : '/nyama-takava').replace(
          /^#/,
          '',
        );
        await test.step(`${route.id} ${path} at ${width}px`, async () => {
          await page.goto(siteURL + path);
          await page.locator('article[data-ready="1"]').waitFor();
          await deepPass(page);
          const result = await page.evaluate<Probe>(`(${CONTRAST_JS})()`);
          records.push({ route: route.id, path, width: width!, ...result });
          for (const key of ['low', 'ph', 'border'] as const)
            if (result[key].length)
              failures.push({ route: route.id, width, kind: key, violations: result[key] });
        });
      }
      expect(records.filter((record) => record.width === width)).toHaveLength(included.length);
    } finally {
      await context.close();
    }
  }
  const totals = { texts: 0, fields: 0, placeholders: 0, boundaries: 0 };
  for (const record of records)
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += record[key];
  await mkdir('tmp/visual-contrast', { recursive: true });
  await writeFile(
    'tmp/visual-contrast/results.json',
    JSON.stringify({ visits: records, totals, failures }, null, 2) + '\n',
  );
  for (const [key, value] of Object.entries(totals))
    expect(value, key + ' must not be vacuous').toBeGreaterThan(0);
  expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
});
