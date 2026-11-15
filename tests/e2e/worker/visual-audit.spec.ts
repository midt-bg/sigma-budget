import { test, expect } from '../fixtures.ts';
import { downloadBytes } from '../helpers.ts';

// All original contexts used Python's default allow (including legacy storage / no JS).
test.use({
  serviceWorkers: 'allow',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  bypassCSP: true,
  viewport: { width: 390, height: 844 },
});
test('visual audit measures, overview, print and unique landmarks', async ({ page, siteURL }) => {
  const go = async (route: string) => {
    await page.goto(siteURL + route);
    await page.locator('article[data-ready="1"]').waitFor();
  };
  await test.step('measures at 320 and 390 px: wrapping, values, provenance', async () => {
    await go('/merki');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const key of ['prihodni', 'razhodni', 'zakoni']) {
        const tab = page.locator(`[role="tab"][data-key="${key}"]`);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(
          true,
        );
        const buttons = page.locator('#s12-27-lists [role="tab"]');
        expect(await buttons.count()).toBeGreaterThan(0);
        for (const button of await buttons.all())
          expect(await button.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
      }
      await expect(page.locator('[role="tab"][data-key="zakoni"]')).toContainText(
        'Мерки по закони',
      );
      await expect(page.locator('#s12-27-zakoni')).toContainText(
        'Мерките от таблици II-7 и II-8 са подредени по закона, когато мотивите посочват такъв.',
      );
    }
    await page.locator('[role="tab"][data-key="prihodni"]').click();
    const cards = page.locator('[role="tabpanel"]:not([hidden]) .m27-card');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(page.locator('#s12-II_7-table')).toBeHidden();
    expect(
      await page.evaluate(`(() => [...document.querySelectorAll('article *')].filter(e =>
      e.getClientRects().length && getComputedStyle(e).overflowX === 'auto')
      .every(e => e.scrollWidth <= e.clientWidth + 1))()`),
    ).toBe(true);
    expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
    expect(((await cards.count()) + 1) * 3).toBe(
      await page.locator('#s12-II_7-table tbody tr').count(),
    );
    for (const card of await cards.all()) {
      const values = card.locator('.m27-year');
      expect(await values.count()).toBe(3);
      for (const [i, year] of ['2027', '2028', '2029'].entries()) {
        const row = values.nth(i);
        await expect(row.locator('dt')).toContainText(year);
        await expect(row.locator('dd')).toBeVisible();
        expect((await row.locator('dd').innerText()).trim()).not.toBe('');
        const box = await row.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      }
      expect(await card.locator('details.s12-quote blockquote').count()).toBe(1);
      expect(await card.getByText('budget2027-provenance.json').count()).toBe(0);
    }
  });
  await test.step('measure deep link and complete CSV', async () => {
    await go('/merki?per=2028.forecast&to=s12-II_7-1-1');
    await expect(page.locator('#s12-II_7-1-1')).toBeFocused();
    await expect(page.locator('#s12-II_7-1-1')).toBeInViewport();
    await page.locator('[data-share="s12-II_7"]').click();
    const pending = page.waitForEvent('download');
    await page.locator('[data-act="csv"]').click();
    const rows = parseCsv(
      (await downloadBytes(await pending)).toString('utf8').replace(/^\uFEFF/, ''),
    );
    expect(rows.length).toBe((await page.locator('#s12-II_7-table tbody tr').count()) + 1);
    expect(rows[0]).toContain('Произход');
    expect(rows[0]).toContain('Връзка към произхода');
  });
  await test.step('tablet expert table', async () => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await expect(page.locator('.m27-card').first()).toBeVisible();
    await page.locator('#s12-II_7-d > summary').click();
    await expect(page.locator('#s12-II_7-table')).toBeVisible();
    expect(await page.locator('#s12-II_7-table th[scope="col"]').count()).toBe(4);
    expect(
      await page.locator('#s12-II_7-table').getByText('budget2027-provenance.json').count(),
    ).toBe(0);
  });
  await test.step('Budget 2027 overview and investment projects', async () => {
    await go('/byudzhet-2027');
    expect(await page.locator('#b27-nakratko .kpi').count()).toBe(6);
    await expect(page.locator('#b27-sravnenie-table')).toBeVisible();
    await expect(page.locator('#b27-kapitalovi-fig')).toBeVisible();
    expect(
      await page.locator('#b27-prihodi, #b27-merki, #b27-obshtini, #b27-dalg, #s34-bill').count(),
    ).toBe(0);
    const more = page.locator('#b27-more a.link-card');
    expect(await more.count()).toBeGreaterThanOrEqual(8);
    await expect(more.last()).toBeVisible();
    for (const path of ['/prihodi', '/merki', '/obshtini', '/dalg', '/prognoza'])
      await expect(
        page.locator(`#b27-more a.link-card[href*="${path}?"][href*="per=2027.draft"]`),
      ).toHaveCount(1);
    expect(await page.locator('#s34-projects .kpi').count()).toBe(3);
    await expect(page.locator('#s34-projects-by-institution-fig')).toBeVisible();
    const projects = page.locator('#s34-projects-table');
    await expect(projects).toBeVisible();
    expect(await projects.locator('thead th').count()).toBe(4);
    expect(await projects.locator('tbody tr').count()).toBe(10);
    expect(await projects.getByText('budget2027-provenance.json').count()).toBe(0);
    await page.locator('#s34-all-projects > summary').click();
    await page.locator('#s34-q').fill('струма');
    await expect(page.locator('#s34-count')).toHaveText(/^Намерени проекти: [1-9]\d?\.$/);
    const count = await page.locator('#s34-project-details tbody tr').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(226);
    await page.setViewportSize({ width: 412, height: 900 });
    await go('/byudzhet-2027');
    expect(await page.evaluate('document.documentElement.scrollWidth')).toBeLessThanOrEqual(412);
    expect(
      await page
        .locator('#s34-projects-table thead')
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 820, height: 1180 });
  });
  await test.step('forecast provenance and legacy measure', async () => {
    await go('/prognoza?per=2027.draft');
    expect(await page.locator('.fig-table table').count()).toBeGreaterThan(0);
    expect(await page.locator('.fig-table thead th', { hasText: 'произход' }).count()).toBe(0);
    await go('/merki/kr1?per=2026.law');
    await expect(page.locator('h1')).not.toBeEmpty();
    expect(await page.locator('.measure-cards').count()).toBe(0);
  });
  await test.step('print light palette and chart labels', async () => {
    await go('/prihodi');
    await page.emulateMedia({ media: 'print' });
    expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).color)).toBe(
      'rgb(21, 17, 12)',
    );
    expect(await page.evaluate('getComputedStyle(document.documentElement).colorScheme')).toBe(
      'light',
    );
    expect(
      (
        await page.evaluate<string>(
          'getComputedStyle(document.documentElement).getPropertyValue("--series-1").trim()',
        )
      ).toLowerCase(),
    ).toBe('#15110c');
    expect(
      await page
        .locator(
          '.block-tools:visible, .seg:visible, .unit-switch:visible, .explorer:visible, .foot-nav:visible',
        )
        .count(),
    ).toBe(0);
    const chart = page.locator('.chart').first();
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute('data-ready', '1');
    await expect(chart.locator('text').first()).toHaveAttribute('fill', /^#15110C$/i);
    await page.emulateMedia({ media: 'screen' });
  });
  for (const path of ['/5-minuti?per=2026.law', '/5-minuti'])
    await test.step('landmark-unique ' + path, async () => {
      await go(path);
      if (path.includes('?'))
        await expect(page.locator('.s04-deep h3').first()).toHaveText('Влез по-дълбоко');
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      expect(
        await page.evaluate(`(async () => (await axe.run(document,
        {runOnly: ['landmark-unique']})).violations)()`),
      ).toEqual([]);
    });
});
for (const stored of ['dark', 'system', 'invalid'])
  test('dark OS with legacy storage ' + stored, async ({ browser, siteURL }) => {
    const context = await browser.newContext({
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      serviceWorkers: 'allow',
    });
    context.setDefaultTimeout(30_000);
    context.setDefaultNavigationTimeout(30_000);
    try {
      await context.addInitScript(`localStorage.setItem('bns.theme', ${"'" + stored + "'"})`);
      const page = await context.newPage();
      await page.goto(siteURL + '/prihodi');
      await page.locator('article[data-ready="1"]').waitFor();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      expect(await page.evaluate('getComputedStyle(document.documentElement).colorScheme')).toBe(
        'light',
      );
      expect(await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
        'rgb(253, 250, 244)',
      );
      expect(await page.locator('h1').evaluate((e) => getComputedStyle(e).color)).toBe(
        'rgb(21, 17, 12)',
      );
      expect(
        await page.locator('[data-theme-pick], .theme-pick, [aria-label="Тема на сайта"]').count(),
      ).toBe(0);
      expect(await page.locator('script[src*="theme-boot"]').count()).toBe(0);
      const chart = page.locator('.chart').first();
      await chart.scrollIntoViewIfNeeded();
      await expect(chart).toHaveAttribute('data-ready', '1');
      await expect(chart.locator('text').first()).toHaveAttribute('fill', /^#15110C$/i);
      await page.reload();
      await page.locator('article[data-ready="1"]').waitFor();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    } finally {
      await context.close();
    }
  });
test('dark OS without JavaScript stays light', async ({ browser, siteURL }) => {
  const context = await browser.newContext({
    colorScheme: 'dark',
    javaScriptEnabled: false,
    serviceWorkers: 'allow',
  });
  context.setDefaultTimeout(30_000);
  context.setDefaultNavigationTimeout(30_000);
  try {
    const page = await context.newPage();
    await page.goto(siteURL + '/merki');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.locator('body').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
      'rgb(253, 250, 244)',
    );
    expect(await page.locator('[data-theme-pick], .theme-pick').count()).toBe(0);
  } finally {
    await context.close();
  }
});
/** Independent semicolon CSV parser, including quoted newlines and escaped quotes. */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ';' && !quoted) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
