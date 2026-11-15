import { test, expect } from '../fixtures.ts';
import { downloadBytes, parseCsv } from '../helpers.ts';
test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
for (const width of [1280, 390]) {
  test(`current-bill lists at ${width}px`, async ({ browser, siteURL }, testInfo) => {
    const errors: string[] = [];
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width === 390,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    async function go(path: string) {
      await page.goto(siteURL + path);
      await page.locator('article[data-ready="1"]').waitFor();
    }
    const query = () => new URL(page.url()).searchParams;
    async function capture(name: string) {
      expect(await page.evaluate('document.documentElement.scrollWidth > innerWidth')).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`${width}-${name}.png`), fullPage: true });
    }
    async function compareSSR(selector: string, backSelector?: string) {
      // The original no-JS context allowed service workers.
      const staticContext = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width, height: 900 },
        serviceWorkers: 'allow',
      });
      try {
        const other = await staticContext.newPage();
        await other.goto(page.url());
        expect(await other.locator(selector).innerText()).toBe(
          await page.locator(selector).innerText(),
        );
        if (backSelector)
          expect(await other.locator(backSelector).first().getAttribute('href')).toBe(
            await page.locator(backSelector).first().getAttribute('href'),
          );
      } finally {
        await staticContext.close();
      }
    }
    try {
      await go('/vedomstva?variant=billMc');
      await expect(page.locator('#s10-bill-table tbody tr')).toHaveCount(1);
      await expect(page.locator('#s10-bill-table tbody')).toContainText('съдебната власт');
      await page.locator('#bill-variant').selectOption('bill');
      await expect(page.locator('#s10-bill-table tbody tr')).toHaveCount(47);
      let field = page.locator('#bill-q');
      await field.fill('  vatreshnite  ');
      await expect(page.locator('#s10-bill-table tbody tr')).toHaveCount(1);
      await expect(page.locator('#s10-bill-table tbody')).toContainText('вътрешните работи');
      await expect(field).toBeFocused();
      await expect(page.locator('#bill-count')).toHaveText('Намерени ведомства: 1.');
      expect(query().getAll('q')).toEqual(['vatreshnite']);
      await field.press('Escape');
      await expect(page.locator('#s10-bill-table tbody tr')).toHaveCount(47);
      await expect(field).toBeFocused();
      const sort = page.locator('#s10-bill-table .th-sort[data-key="expenditure"]');
      await sort.click();
      await sort.click();
      expect(query().getAll('sort')).toEqual(['expenditure']);
      expect(query().getAll('dir')).toEqual(['desc']);
      await expect(sort.locator('..')).toHaveAttribute('aria-sort', 'descending');
      await compareSSR('#s10-bill-table tbody');
      await field.fill('министерств');
      await expect(page.locator('#bill-count')).not.toHaveText('Намерени ведомства: 47.');
      const count = await page.locator('#s10-bill-table tbody tr').count();
      const first = await page.locator('#s10-bill-table tbody th').first().innerText();
      await page.locator('[data-share="s10-bill-list"]').click();
      const downloaded = page.waitForEvent('download');
      await page.locator('[data-act="csv"]').click();
      const csv = await downloadBytes(await downloaded);
      await testInfo.attach('institutions.csv', { body: csv, contentType: 'text/csv' });
      const rows = parseCsv(csv.toString('utf8').replace(/^\uFEFF/, ''));
      expect(rows).toHaveLength(count + 1);
      expect(rows[1]![0]).toBe(first);
      expect(rows[0]!).toContain('Разходи, хил. €');
      for (const [column, value] of [
        ['период', '2027.draft'],
        ['единица', 'хил. €'],
      ] as const) {
        expect(rows[0]!).toContain(column);
        expect(rows.slice(1).every((row) => row[rows[0]!.indexOf(column)] === value)).toBe(true);
      }
      expect(rows[0]!).toContain('източник');
      expect(rows[0]!).toContain('обхват');
      expect(rows.slice(1).every((row) => !!row[rows[0]!.indexOf('източник')])).toBe(true);
      expect(
        rows
          .slice(1)
          .every((row) => row[rows[0]!.indexOf('обхват')]!.includes('не е целият бюджет')),
      ).toBe(true);
      const shared: string = await page.evaluate(
        "(async () => { const s = await import('/js/share.js'); return s.linkFor(s.get('s10-bill-list')); })()",
      );
      const fresh = await browser.newContext({
        viewport: { width, height: 900 },
        serviceWorkers: 'block',
        reducedMotion: 'reduce',
      });
      try {
        const twin = await fresh.newPage();
        await twin.goto(shared);
        await twin.locator('article[data-ready="1"]').waitFor();
        await expect(twin.locator('#s10-bill-table tbody tr')).toHaveCount(count);
        expect(await twin.locator('#s10-bill-table tbody th').first().innerText()).toBe(first);
        await expect(twin.locator('#s10-bill-table th[aria-sort="descending"]')).toHaveCount(1);
      } finally {
        await fresh.close();
      }
      await capture('institution-list');
      await page.locator('#s10-bill-table tbody a').first().click();
      await page.locator('article[data-route="S11"][data-ready="1"]').waitFor();
      expect(query().getAll('q')).toEqual(['министерств']);
      expect(query().getAll('dir')).toEqual(['desc']);
      let back = 'main nav[aria-label="Трохи"] a[href*="/vedomstva"]';
      await compareSSR('#s11-bill-rows tbody', back);
      await page.locator(back).click();
      await expect(page.locator('#s10-bill-table tbody tr')).toHaveCount(count);
      expect(await page.locator('#s10-bill-table tbody th').first().innerText()).toBe(first);
      await field.fill('zzzzzzzz');
      await expect(page.locator('#bill-count')).toHaveText('Намерени ведомства: 0.');
      await expect(page.locator('#s10-bill-table tbody')).toContainText('изчисти търсенето');
      await page.locator('#s10-bill-table .th-sort[data-key="name"]').click();
      await expect(page.locator('#s10-bill-table tbody')).toContainText('Няма ведомства');
      await page.locator('[data-bill-clear]').click();
      await expect(field).toBeFocused();
      await expect(page.locator('#s10-bill-table tbody tr')).toHaveCount(47);
      await go('/obshtini?oblast=unknown&q=%20Благоевград%20');
      await expect(page.locator('#bill-oblast')).toHaveValue('');
      await expect(page.locator('#s20-bill-table tbody tr')).toHaveCount(1);
      await expect(page.locator('#s20-list-2027')).toContainText('Непозната област');
      await compareSSR('#s20-bill-table tbody');
      await go('/obshtini?oblast=BLG');
      field = page.locator('#bill-q');
      await field.fill('blagoevgrad');
      await expect(page.locator('#bill-count')).toHaveText('Намерени общини: 1.');
      await expect(field).toBeFocused();
      await page.locator('#s20-bill-table .th-sort[data-key="v0"]').click();
      await page.locator('#s20-bill-table .th-sort[data-key="v0"]').click();
      await capture('municipal-list');
      await page.locator('#s20-bill-table tbody a').first().click();
      await page.locator('article[data-route="S21"][data-ready="1"]').waitFor();
      expect(query().getAll('oblast')).toEqual(['BLG']);
      expect(query().getAll('q')).toEqual(['blagoevgrad']);
      back = 'main nav[aria-label="Трохи"] a[href*="/obshtini"]';
      await compareSSR('#s21-transfers-2027-table tbody', back);
      await capture('municipal-detail');
      await page.locator(back).click();
      await expect(page.locator('#bill-oblast')).toHaveValue('BLG');
      await expect(page.locator('#bill-q')).toHaveValue('blagoevgrad');
      await expect(page.locator('#s20-bill-table th[aria-sort="descending"]')).toHaveCount(1);
      field = page.locator('#bill-q');
      await field.fill('няматакаваобщина');
      await expect(page.locator('#bill-count')).toHaveText('Намерени общини: 0.');
      await capture('municipal-empty');
      await field.press('Escape');
      await expect(page.locator('#bill-count')).not.toHaveText('Намерени общини: 0.');
      await expect(page.locator('#bill-oblast')).toHaveValue('BLG');
      for (const [path, text] of [
        ['/prihodi?per=2028.forecast', '2028'],
        ['/razhodi?per=2029.forecast', '2029'],
        ['/obshtini?per=2028.forecast', '2028'],
        ['/vedomstva?per=2026.law', '2026'],
      ] as const) {
        await go(path);
        await expect(page.locator('.context')).toContainText(text);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
