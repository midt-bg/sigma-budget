import { test, expect } from '../audit-fixtures.ts';
import type { Page } from '@playwright/test';

const trigger = (page: Page) =>
  page.getByRole('button', { name: 'Меню за достъпност', exact: true });
async function choose(page: Page, selector: string) {
  await trigger(page).click();
  await page.locator(selector).click();
  await page.keyboard.press('Escape');
}

test('skip first, panel second: keyboard, ARIA and visible focus', async ({ page, visit }) => {
  await visit('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(trigger(page)).toBeFocused();
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
  await trigger(page).press('Enter');
  await expect(trigger(page)).toHaveAttribute('aria-controls', 'a11y-tools-panel');
  await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
  for (const option of await page.locator('.a11y-tools__nav button').all()) {
    await page.keyboard.press('Tab');
    await expect(option).toBeFocused();
    expect(await option.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  }
  await page.keyboard.press('Escape');
  await expect(trigger(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.a11y-tools__nav :focus')).toHaveCount(0);
  await choose(page, '.a11y__item--dyslexic button');
  await trigger(page).click();
  await expect(page.locator('.a11y__item--dyslexic button')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.a11y__item--increase button')).not.toHaveAttribute('aria-pressed');
});

test('ADYS covers every visible text node, including charts, headings and navigation', async ({
  page,
  visit,
}) => {
  for (const path of ['/dalg', '/razhodi', '/rechnik']) {
    await visit(path);
    if (path === '/dalg') await choose(page, '.a11y__item--dyslexic button');
    for (const chart of await page.locator('.chart:visible').all()) {
      await chart.scrollIntoViewIfNeeded();
      await expect(chart).toHaveAttribute('data-ready', '1');
    }
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const failures: string[] = [];
          while (walker.nextNode()) {
            const node = walker.currentNode,
              el = node.parentElement;
            if (
              !node.textContent?.trim() ||
              !el ||
              el.closest('script,style,.sr-only,[hidden]') ||
              !el.checkVisibility()
            )
              continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            if (![...range.getClientRects()].some((r) => r.width && r.height)) continue;
            if (!getComputedStyle(el).fontFamily.includes('adys'))
              failures.push(node.textContent.slice(0, 60));
          }
          return failures;
        }),
      )
      .toEqual([]);
    expect(await page.evaluate(() => document.fonts.check('16px adys'))).toBe(true);
  }
});

test('text mode shows chart numbers and survives application navigation', async ({
  page,
  visit,
}) => {
  await visit('/dalg');
  await choose(page, '.a11y__item--textonly button');
  for (const path of ['/dalg', '/razhodi']) {
    if (path !== '/dalg') await page.locator('#footer a[href="/razhodi"]').click();
    await expect(page.locator('#view')).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#view svg:visible')).toHaveCount(0);
    const tables = page.locator('details.fig-table');
    await expect(tables.first().locator('table')).toBeVisible();
    expect(await tables.count()).toBeGreaterThan(0);
    for (const table of await tables.all()) {
      await expect(table.locator('table')).toBeVisible();
      expect(await table.locator('tbody').innerText()).toMatch(/\d/);
    }
  }
  expect(
    await trigger(page).evaluate(
      (el) => el.closest('.accessibility-controls')!.previousElementSibling!.className,
    ),
  ).toBe('skip-link');
});

test('larger type reflows at 360px on several pages', async ({ page, visit }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  for (const path of ['/', '/dalg', '/razhodi', '/rechnik']) {
    await visit(path);
    if (path === '/') await choose(page, '.a11y__item--increase button');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await expect(page.locator('#topbar')).toBeVisible();
  }
});

test('trigger stays above the phone tabbar with standard and enlarged type', async ({
  page,
  visit,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await visit('/');
  for (const enlarged of [false, true]) {
    if (enlarged) await choose(page, '.a11y__item--increase button');
    const button = await trigger(page).boundingBox(),
      tabs = await page.locator('#tabbar').boundingBox();
    expect(button!.y + button!.height).toBeLessThanOrEqual(tabs!.y);
  }
});

test('preferences restore before initialization, reload and application navigation', async ({
  page,
  visit,
}) => {
  await visit('/');
  await choose(page, '.a11y__item--dyslexic button');
  await choose(page, '.a11y__item--increase button');
  await choose(page, '.a11y__btn--blue');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/accessibility/accessibility.js', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(new URL('/dalg', page.url()).href, { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveClass(/dyslectic-font/);
  await expect(page.locator('html')).toHaveClass(/font-resize/);
  await expect(page.locator('html')).toHaveClass(/accessibility-blue/);
  await expect(page.locator('.accessibility-controls')).toHaveCount(0);
  release();
  await expect(trigger(page)).toBeVisible();
  await expect(page.locator('#view h1')).toHaveCSS('font-family', /adys/);
  await page.locator('#footer a[href="/rechnik"]').click();
  await expect(page).toHaveURL(/\/rechnik/);
  await expect(page.locator('#view')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#view h1')).toHaveCSS('font-family', /adys/);
  await page.reload();
  await expect(trigger(page)).toBeVisible();
  await expect(page.locator('#view h1')).toHaveCSS('font-family', /adys/);
  await choose(page, '.a11y__item--textonly button');
  await page.reload();
  await expect(trigger(page)).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/a11y-textonly/);
  await choose(page, '.a11y__item--clear button');
  await page.locator('#footer a[href="/razhodi"]').click();
  await expect(page).toHaveURL(/\/razhodi/);
  await expect(page.locator('#view')).not.toHaveAttribute('aria-busy', 'true');
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.styleSheets]
          .filter((s) => s.href?.includes('/css/pages/'))
          .every((s) => !s.disabled),
      ),
    )
    .toBe(true);
});

test('default search and option padding equals the browser and site cascade', async ({
  page,
  visit,
}) => {
  for (const path of ['/', '/danni', '/dalg']) {
    await visit(path);
    const result = await page.evaluate(() => {
      const read = () =>
        [...document.querySelectorAll('#btn-search,.s24-clear,option,input')].map((el) => {
          const s = getComputedStyle(el);
          return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
        });
      const actual = read();
      const sheet = [...document.styleSheets].find((s) =>
        s.href?.endsWith('/css/accessibility.css'),
      )!;
      sheet.disabled = true;
      const baseline = read();
      sheet.disabled = false;
      return { actual, baseline };
    });
    expect(result.actual).toEqual(result.baseline);
  }
});

test('embedded view has no panel', async ({ page, visit }) => {
  await visit('/embed/s17-dalg-chart');
  await expect(page.locator('body')).toHaveClass(/bare/);
  await expect(page.locator('.accessibility-controls')).toHaveCount(0);
});

test('contrast variants and reset keep their state accessible', async ({ page, visit }) => {
  await visit('/');
  for (const mode of ['yellow', 'dark', 'blue', 'clear']) {
    await choose(page, `.a11y__btn--${mode}`);
    await trigger(page).click();
    await expect(page.locator(`.a11y__btn--${mode}`)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
  }
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/accessibility-null/);
  await choose(page, '.a11y__item--increase button');
  await choose(page, '.a11y__item--clear button');
  await expect(page.locator('html')).not.toHaveClass(/font-resize/);
});
