import { test, expect } from '../visitor-fixtures.ts';
import { downloadBytes, parseCsv } from '../helpers.ts';

test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
for (const width of [1280, 390]) {
  test(`parliamentary publication, calculated revenue and source disclosures at ${width}px`, async ({
    freshContext,
    siteURL,
  }, testInfo) => {
    const context = await freshContext({
      viewport: { width, height: 900 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    async function go(path: string) {
      const response = await page.goto(siteURL + path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('article.page')).toHaveAttribute('data-ready', '1');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await expect(page.locator('article.page')).not.toContainText(/NaN|undefined|стр\.\s*null/);
    }
    try {
      await go('/vedomstva');
      const totals = page.locator('#s10-bill-totals');
      await expect(totals).not.toContainText('Няма сбор');
      await expect(totals).toContainText('включва изчислен приход');
      await expect(totals).toContainText('Приходната клетка в документа е празна');
      await expect(totals).toContainText('16.11.2026');
      await totals.scrollIntoViewIfNeeded();
      await testInfo.attach('institution-totals.png', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await page.locator('[data-share="s10-bill-list"]').click();
      const pending = page.waitForEvent('download');
      await page.locator('[data-act="csv"]').click();
      const csv = await downloadBytes(await pending);
      const rows = parseCsv(csv.toString('utf8').replace(/^\uFEFF/, ''));
      expect(rows).toHaveLength(48);
      const header = rows[0]!;
      const method = header.indexOf('Основание за приходите');
      expect(method).toBeGreaterThan(-1);
      const calculated = rows.slice(1).filter((row) => row[method]?.startsWith('Изчислено'));
      expect(calculated).toHaveLength(1);
      expect(calculated[0]![header.indexOf('Собствени приходи, хил. €')]).toMatch(/^0(?:,0)?$/);
      expect(calculated[0]![header.indexOf('Произход на приходите')]).toContain(
        'budget2027-provenance.json#',
      );
      await testInfo.attach('institutions.csv', { body: csv, contentType: 'text/csv' });
      await go('/vedomstvo/0200');
      await expect(page.locator('#s11-budget-2027')).toContainText('Собствени приходи (изчислено)');
      await go('/vedomstvo/2100');
      await expect(page.locator('article.page')).toContainText('Ангажименти');
      await go('/byudzhet-2027');
      await expect(page.locator('#s34-projects')).toContainText('NP-25.001-0169');
      await expect(page.locator('#s34-projects')).toContainText(
        'Това не установява, че проектът е отменен',
      );
      await expect(page.locator('#s34-projects-table')).not.toContainText('NP-25.001-0169');
      await page.locator('#s34-projects').scrollIntoViewIfNeeded();
      await testInfo.attach('investment-projects.png', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      for (const path of ['/prognoza', '/merki?per=2027.draft', '/obshtini']) await go(path);
      expect(errors).toEqual([]);
      const staticContext = await freshContext({
        javaScriptEnabled: false,
        viewport: { width, height: 900 },
        serviceWorkers: 'block',
      });
      try {
        const staticPage = await staticContext.newPage();
        await staticPage.goto(siteURL + '/vedomstva');
        await expect(staticPage.locator('#s10-bill-totals')).toContainText(
          'включва изчислен приход',
        );
        await expect(staticPage.locator('#s10-bill-totals')).not.toContainText('Няма сбор');
      } finally {
        await staticContext.close();
      }
    } finally {
      await context.close();
    }
  });
}
