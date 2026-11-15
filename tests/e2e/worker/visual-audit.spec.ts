import type { AxeResults, RunOptions } from 'axe-core';
import { test, expect } from '../audit-fixtures.ts';
import { downloadBytes } from '../helpers.ts';

test.use({
  serviceWorkers: 'allow',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  bypassCSP: true,
  viewport: { width: 390, height: 844 },
});

test.describe('measure cards on phones', () => {
  for (const width of [320, 390]) {
    test(`tabs and law-index labels fit at ${width}px`, async ({ page, visit }) => {
      await visit('/merki');
      await page.setViewportSize({ width, height: 844 });
      for (const key of ['prihodni', 'razhodni', 'zakoni']) {
        const tab = page.locator(`[role="tab"][data-key="${key}"]`);
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect
          .poll(() => page.locator('html').evaluate((element) => element.scrollWidth <= innerWidth))
          .toBe(true);
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
    });
  }
  test('every measure retains its three years and folded motives at 390px', async ({
    page,
    visit,
  }) => {
    await visit('/merki');
    await page.locator('[role="tab"][data-key="prihodni"]').click();
    const cards = page.locator('[role="tabpanel"]:not([hidden]) .m27-card');
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(page.locator('#s12-II_7-table')).toBeHidden();
    expect(
      await page
        .locator('article *')
        .evaluateAll((elements) =>
          elements
            .filter(
              (element) =>
                element.getClientRects().length && getComputedStyle(element).overflowX === 'auto',
            )
            .every((element) => element.scrollWidth <= element.clientWidth + 1),
        ),
    ).toBe(true);
    await expect
      .poll(() => page.locator('html').evaluate((element) => element.scrollWidth <= innerWidth))
      .toBe(true);
    expect(((await cards.count()) + 1) * 3).toBe(
      await page.locator('#s12-II_7-table tbody tr').count(),
    );
    for (const card of await cards.all()) {
      const values = card.locator('.m27-year');
      await expect(values).toHaveCount(3);
      for (const [i, year] of ['2027', '2028', '2029'].entries()) {
        const row = values.nth(i);
        await expect(row.locator('dt')).toContainText(year);
        await expect(row.locator('dd')).toBeVisible();
        await expect(row.locator('dd')).toHaveText(/\S/);
        const box = await row.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      }
      await expect(card.locator('details.s12-quote blockquote')).toHaveCount(1);
      await expect(card.getByText('budget2027-provenance.json')).toHaveCount(0);
    }
  });
  test('search deep link focuses the measure value and CSV retains every original row', async ({
    page,
    visit,
  }) => {
    await visit('/merki?per=2028.forecast&to=s12-II_7-1-1');
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
});

test.describe('tablet tables and Budget 2027', () => {
  test.use({ viewport: { width: 820, height: 1180 } });
  test('expert table shows four columns with CSV-only provenance', async ({ page, visit }) => {
    await visit('/merki?per=2028.forecast&to=s12-II_7-1-1');
    await expect(page.locator('.m27-card').first()).toBeVisible();
    await page.locator('#s12-II_7-d > summary').click();
    await expect(page.locator('#s12-II_7-table')).toBeVisible();
    await expect(page.locator('#s12-II_7-table th[scope="col"]')).toHaveCount(4);
    await expect(
      page.locator('#s12-II_7-table').getByText('budget2027-provenance.json'),
    ).toHaveCount(0);
  });
  test('overview keeps key figures, period links and searchable investment projects', async ({
    page,
    visit,
  }) => {
    await visit('/byudzhet-2027');
    await expect(page.locator('#b27-nakratko .kpi')).toHaveCount(6);
    await expect(page.locator('#b27-sravnenie-table')).toBeVisible();
    await expect(page.locator('#b27-kapitalovi-fig')).toBeVisible();
    await expect(
      page.locator('#b27-prihodi, #b27-merki, #b27-obshtini, #b27-dalg, #s34-bill'),
    ).toHaveCount(0);
    const more = page.locator('#b27-more a.link-card');
    expect(await more.count()).toBeGreaterThanOrEqual(8);
    await expect(more.last()).toBeVisible();
    for (const path of ['/prihodi', '/merki', '/obshtini', '/dalg', '/prognoza'])
      await expect(
        page.locator(`#b27-more a.link-card[href*="${path}?"][href*="per=2027.draft"]`),
      ).toHaveCount(1);
    await expect(page.locator('#s34-projects .kpi')).toHaveCount(3);
    await expect(page.locator('#s34-projects-by-institution-fig')).toBeVisible();
    const projects = page.locator('#s34-projects-table');
    await expect(projects).toBeVisible();
    await expect(projects.locator('thead th')).toHaveCount(4);
    await expect(projects.locator('tbody tr')).toHaveCount(10);
    await expect(projects.getByText('budget2027-provenance.json')).toHaveCount(0);
    await page.locator('#s34-all-projects > summary').click();
    await page.locator('#s34-q').fill('струма');
    await expect(page.locator('#s34-count')).toHaveText(/^Намерени проекти: [1-9]\d?\.$/);
    const count = await page.locator('#s34-project-details tbody tr').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(226);
  });
  test('forecast tables keep provenance out of the visible headings', async ({ page, visit }) => {
    await visit('/prognoza?per=2027.draft');
    expect(await page.locator('.fig-table table').count()).toBeGreaterThan(0);
    await expect(page.locator('.fig-table thead th', { hasText: 'произход' })).toHaveCount(0);
  });
  test('legacy measure has a heading without duplicate cards', async ({ page, visit }) => {
    await visit('/merki/kr1?per=2026.law');
    await expect(page.locator('h1')).not.toBeEmpty();
    await expect(page.locator('.measure-cards')).toHaveCount(0);
  });
  test('print uses the light palette and hides interactive controls', async ({ page, visit }) => {
    await visit('/prihodi');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('h1')).toHaveCSS('color', 'rgb(21, 17, 12)');
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--series-1').trim().toLowerCase(),
          ),
      )
      .toBe('#15110c');
    await expect(
      page.locator(
        '.block-tools:visible, .seg:visible, .unit-switch:visible, .explorer:visible, .foot-nav:visible',
      ),
    ).toHaveCount(0);
    const chart = page.locator('.chart').first();
    await expect(chart).toBeVisible();
    await expect(chart).toHaveAttribute('data-ready', '1');
    await expect(chart.locator('text').first()).toHaveAttribute('fill', /^#15110C$/i);
    await page.emulateMedia({ media: 'screen' });
  });
  for (const path of ['/5-minuti?per=2026.law', '/5-minuti']) {
    test(`unique landmarks on ${path}`, async ({ page, visit }) => {
      await visit(path);
      if (path.includes('?'))
        await expect(page.locator('.s04-deep h3').first()).toHaveText('Влез по-дълбоко');
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const violations = await page.evaluate(
        async (options: RunOptions): Promise<AxeResults['violations']> => {
          const { axe } = window as unknown as {
            axe: { run: (document: Document, options: RunOptions) => Promise<AxeResults> };
          };
          return (await axe.run(document, options)).violations;
        },
        { runOnly: ['landmark-unique'] },
      );
      expect(violations).toEqual([]);
    });
  }
});
test.describe('Budget 2027 on phones', () => {
  test.use({ viewport: { width: 412, height: 900 } });
  test('overview fits 412px with compact investment table headings', async ({ page, visit }) => {
    await visit('/byudzhet-2027');
    await expect
      .poll(() => page.locator('html').evaluate((element) => element.scrollWidth))
      .toBeLessThanOrEqual(412);
    expect(
      await page
        .locator('#s34-projects-table thead')
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(1);
  });
});
test.describe('dark OS preferences', () => {
  test.use({ colorScheme: 'dark', bypassCSP: false, viewport: { width: 1280, height: 720 } });
  for (const stored of ['dark', 'system', 'invalid'] as const) {
    test(`saved theme "${stored}" stays light after navigation and reload`, async ({
      page,
      visit,
      context,
    }) => {
      await context.addInitScript(
        (theme: string): void => localStorage.setItem('bns.theme', theme),
        stored,
      );
      await visit('/prihodi');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(253, 250, 244)');
      await expect(page.locator('h1')).toHaveCSS('color', 'rgb(21, 17, 12)');
      await expect(
        page.locator('[data-theme-pick], .theme-pick, [aria-label="Тема на сайта"]'),
      ).toHaveCount(0);
      await expect(page.locator('script[src*="theme-boot"]')).toHaveCount(0);
      const chart = page.locator('.chart').first();
      await chart.scrollIntoViewIfNeeded();
      await expect(chart).toHaveAttribute('data-ready', '1');
      await expect(chart.locator('text').first()).toHaveAttribute('fill', /^#15110C$/i);
      await page.reload();
      await expect(page.locator('article[data-ready]')).toHaveAttribute('data-ready', '1', {
        timeout: 30_000,
      });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    });
  }
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false, reducedMotion: 'no-preference' });
    test('server HTML stays light', async ({ page, siteURL }) => {
      await page.goto(siteURL + '/merki');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(253, 250, 244)');
      await expect(page.locator('[data-theme-pick], .theme-pick')).toHaveCount(0);
    });
  });
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
