import { readFileSync } from 'node:fs';
import { test, expect, enableHashRoutes } from '../fixtures.ts';

test.use({ reducedMotion: 'reduce' });

const load = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../data/release/${name}.json`, import.meta.url), 'utf8'));
const number = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));

test('debt summary shows the selected data in one row on phone and desktop', async ({
  page,
  siteURL,
}) => {
  await enableHashRoutes(page);
  const debt = load('debt'),
    bill = load('budget2027');
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const key of [
      '2024.report',
      '2025.report',
      '2026.law',
      '2027.draft',
      '2028.forecast',
      '2029.forecast',
    ]) {
      await page.goto(`${siteURL}/index.html#/dalg?per=${key}`);
      await page.waitForSelector('article[data-ready="1"]');
      const band = page.locator('#s17-b-kpi');
      const tiles = band.locator('.kpi');
      await expect(tiles).toHaveCount(3);
      const year = Number(key.slice(0, 4));
      const frameworkColumns: Record<string, number> = {
        '2027.draft': 2,
        '2028.forecast': 3,
        '2029.forecast': 4,
      };
      const frameworkColumn = frameworkColumns[key];
      const i = debt.zdd.years.indexOf(year);
      const total = frameworkColumn
        ? bill.forecast.VI_1[0].cells[frameworkColumn].value
        : debt.zdd.totalMln[i];
      const pg = frameworkColumn
        ? bill.forecast.VI_1[1].cells[frameworkColumn].value
        : debt.zdd.pctGdp[i];
      const interestText: Record<string, string> = {
        '2024.report': '515,9',
        '2025.report': '737,1',
        '2026.law': '1,06',
        '2027.draft': '1,43',
        '2028.forecast': '1,85',
        '2029.forecast': '2,30',
      };
      const values = await tiles.locator('.kpi-num').allTextContents();
      expect(number(values[0]!)).toBe(Number(pg.toFixed(1)));
      expect(number(values[1]!)).toBe(Number((total / 1000).toFixed(2)));
      await expect(tiles.nth(1).locator('[data-gl="darzhaven-dalg"]')).toBeVisible();
      await expect(tiles.nth(2).locator('[data-gl="lihva"]')).toHaveText('Лихви за годината');
      if (key === '2025.report') await expect(tiles.nth(2)).toContainText('предварителни');
      if (key === '2026.law') {
        await expect(tiles.nth(0).locator('.kpi-sub')).toContainText('01.07.2026');
        await expect(tiles.nth(1).locator('.kpi-sub')).toContainText('01.07.2026');
        await expect(tiles.nth(2).locator('.kpi-sub')).toContainText('06.11.2026');
      }
      await expect(tiles.nth(2).locator('.kpi-num')).toHaveText(interestText[key]!);
      const rows = await tiles.evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().y),
      );
      expect(new Set(rows).size).toBe(1);
      for (const tile of await tiles.all())
        await expect(tile.locator('.kpi-sub')).toContainText(String(year));
      await expect(band.locator('[data-share="s17-b-kpi"]')).toBeVisible();
    }
    await page.goto(`${siteURL}/index.html#/dalg?per=2027.draft&obhvat=maastricht`);
    await expect(page.locator('#s17-b-kpi .kpi-num').first()).toHaveText('—');
    await expect(page.locator('#s17-b-kpi .kpi').first()).toContainText(
      'По Маастрихт няма прогноза за тази година.',
    );
    await page.evaluate("import('/js/store.js').then(m => m.store.set('leva', true))");
    await page.goto(`${siteURL}/index.html#/dalg?per=2027.draft`);
    await expect(page.locator('#s17-b-kpi .kpi').nth(1)).toContainText('лв.');
    await expect(page.locator('#s17-b-kpi .kpi').nth(2)).toContainText('лв.');
    await page.evaluate("import('/js/store.js').then(m => m.store.set('leva', false))");
    await page.goto(`${siteURL}/index.html#/dalg?per=2026.expected`);
    await expect(page.locator('article')).toContainText('Няма данни за 2026 · Очаквано');
    await expect(page.locator('#s17-b-kpi')).toHaveCount(0);
  }
});

test('debt scope comparison starts closed and reveals the existing table', async ({
  page,
  siteURL,
}) => {
  await enableHashRoutes(page);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${siteURL}/index.html#/dalg?per=2026.law`);
    await page.waitForSelector('article[data-ready="1"]');
    const comparison = page.locator('details#s17-b-compare');
    await expect(comparison).not.toHaveAttribute('open');
    await expect(comparison.locator('#s17-t-compare')).toBeAttached();
    await expect(comparison.locator('#s17-t-compare')).not.toBeVisible();
    await comparison.locator('summary').click({ timeout: 10_000 });
    await expect(comparison.locator('#s17-t-compare')).toBeVisible();
    await expect(comparison.locator('.s17-switch a')).toBeVisible();
    await comparison.locator('summary').click({ timeout: 10_000 });
  }
});

test('debt heading and glossary labels distinguish concepts without a command', async ({
  page,
  siteURL,
}) => {
  await enableHashRoutes(page);
  await page.goto(`${siteURL}/index.html#/dalg?per=2026.law`);
  await expect(page.locator('#s17-b-confuse h2')).toHaveText(
    'Дефицит, нов дълг и дълг: три различни числа',
  );
  await page.goto(`${siteURL}/index.html#/rechnik/byudzheten-defitsit`);
  await expect(page.locator('.s03-conf-note strong').first()).toHaveText('Да не се бърка с:');
  await expect(
    page.getByRole('group', { name: 'Да не се бърка с:', exact: true }).first(),
  ).toBeVisible();
});
