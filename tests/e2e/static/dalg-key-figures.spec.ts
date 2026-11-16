import { readFileSync, mkdirSync } from 'node:fs';
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
    outlook = load('outlook'),
    bill = load('budget2027');
  mkdirSync('tmp/screenshots', { recursive: true });
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const key of [
      '2024.report',
      '2025.report',
      '2026.law',
      '2026.expected',
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
      const interest =
        outlook.byPeriod[key]?.series.interest.value ??
        outlook.kfp.interest.mln[outlook.years.indexOf(year)];
      const values = await tiles.locator('.kpi-num').allTextContents();
      if (key === '2026.expected') {
        expect(values.slice(0, 2)).toEqual(['—', '—']);
        await expect(tiles.nth(0)).toContainText('Няма данни за периода');
        await expect(tiles.nth(1)).toContainText('Няма данни за периода');
      } else {
        expect(number(values[0]!)).toBe(Number(pg.toFixed(1)));
        expect(number(values[1]!)).toBe(Number((total / 1000).toFixed(2)));
      }
      expect(number(values[2]!)).toBe(
        Number((interest < 1000 ? interest : interest / 1000).toFixed(interest < 1000 ? 1 : 2)),
      );
      const boxes = await tiles.evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return {
            y: r.y,
            right: r.right,
            width: r.width,
            overflow: n.scrollWidth > n.clientWidth,
          };
        }),
      );
      expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
      expect(boxes.every((b) => b.width > 0 && b.right <= width && !b.overflow)).toBe(true);
      for (const tile of await tiles.all())
        await expect(tile.locator('.kpi-sub')).toContainText(String(year));
      await expect(band.locator('[data-share="s17-b-kpi"]')).toBeVisible();
      if (key === '2027.draft')
        await page.screenshot({ path: `tmp/screenshots/dalg-${width}.png` });
    }
  }
});
