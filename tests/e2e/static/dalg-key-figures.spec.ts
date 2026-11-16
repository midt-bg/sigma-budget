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
        '2026.expected': 1,
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
      expect(number(values[0]!)).toBe(Number(pg.toFixed(1)));
      expect(number(values[1]!)).toBe(Number((total / 1000).toFixed(2)));
      await expect(tiles.nth(1).locator('[data-gl="darzhaven-dalg"]')).toBeVisible();
      await expect(tiles.nth(2).locator('[data-gl="lihva"]')).toHaveText('Лихви по КФП');
      if (key === '2025.report') await expect(tiles.nth(2)).toContainText('предварителни');
      if (key === '2026.law') await expect(band.locator('.block-asof')).toContainText('06.11.2026');
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
      const edges = await band.evaluate((node) => {
        const head = node.querySelector('.block-head')!.getBoundingClientRect();
        const grid = node.querySelector('.s17-key-figures')!;
        const rect = grid.getBoundingClientRect();
        const clip = getComputedStyle(grid).clipPath;
        const inset = clip === 'none' ? 0 : Number(clip.match(/inset\([^ ]+ ([\d.]+)px/)![1]);
        const first = node.querySelector('.kpi-label')!.getBoundingClientRect();
        return {
          left: rect.left + inset,
          right: rect.right - inset,
          headLeft: head.left,
          headRight: head.right,
          textLeft: first.left,
        };
      });
      expect(Math.abs(edges.left - edges.headLeft)).toBeLessThan(1);
      expect(Math.abs(edges.right - edges.headRight)).toBeLessThan(1);
      expect(Math.abs(edges.textLeft - edges.headLeft)).toBeLessThan(1);
      if (['2026.expected', '2027.draft'].includes(key))
        await page.screenshot({ path: `tmp/screenshots/dalg-${key}-${width}.png` });
    }
    await page.goto(`${siteURL}/index.html#/dalg?per=2027.draft&obhvat=maastricht`);
    await expect(page.locator('#s17-b-kpi .kpi-num').first()).toHaveText('—');
    await expect(page.locator('#s17-b-kpi .kpi').first()).toContainText(
      'Методиката стига до 2025 г.',
    );
    await page.evaluate("import('/js/store.js').then(m => m.store.set('leva', true))");
    await page.goto(`${siteURL}/index.html#/dalg?per=2027.draft`);
    await expect(page.locator('#s17-b-kpi .kpi').nth(1)).toContainText('лв.');
    await expect(page.locator('#s17-b-kpi .kpi').nth(2)).toContainText('лв.');
    await page.evaluate("import('/js/store.js').then(m => m.store.set('leva', false))");
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
    await comparison.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp/screenshots/dalg-compare-closed-${width}.png` });
    await comparison.locator('summary').click();
    await expect(comparison.locator('#s17-t-compare')).toBeVisible();
    await expect(comparison.locator('.s17-switch a')).toBeVisible();
    await page.screenshot({ path: `tmp/screenshots/dalg-compare-open-${width}.png` });
    await comparison.locator('summary').click();
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
