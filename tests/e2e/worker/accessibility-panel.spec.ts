import { test, expect } from '../audit-fixtures.ts';

const modes = [
  { name: 'дислексия', selector: '.a11y__item--dyslexic button', marker: 'dyslectic-font' },
  { name: 'голям шрифт', selector: '.a11y__item--increase button', marker: 'font-resize' },
  { name: 'текст', selector: '.a11y__item--textonly button', marker: 'a11y-textonly' },
  { name: 'жълт контраст', selector: '.a11y__btn--yellow', marker: 'accessibility-yellow' },
  { name: 'тъмен контраст', selector: '.a11y__btn--dark', marker: 'accessibility-dark' },
  { name: 'син контраст', selector: '.a11y__btn--blue', marker: 'accessibility-blue' },
  { name: 'оригинален контраст', selector: '.a11y__btn--clear', marker: '' },
];
for (const width of [360, 1280]) {
  test.describe(`${width}px accessibility panel`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const path of ['/', '/dalg', '/razhodi', '/rechnik']) {
      for (const mode of modes) {
        test(`${path}: ${mode.name}, keyboard, reset and reload`, async ({ page, visit }, info) => {
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.addInitScript(() => {
            document.addEventListener('securitypolicyviolation', (event) => {
              (window as typeof window & { cspErrors?: string[] }).cspErrors ??= [];
              (window as typeof window & { cspErrors?: string[] }).cspErrors!.push(
                event.blockedURI,
              );
            });
          });
          await visit(path);
          const trigger = page.getByRole('button', {
            name: 'покажи меню за достъпност',
            exact: true,
          });
          await trigger.focus();
          await trigger.press('Enter');
          await expect(trigger).toHaveAttribute('aria-expanded', 'true');
          await expect(trigger).toBeFocused();
          // All options are reachable in the ordinary Tab sequence with visible focus.
          for (let i = 0; i < 8; i++) {
            await page.keyboard.press('Tab');
            await expect(page.locator('#accessibility-panel button').nth(i)).toBeFocused();
            expect(
              await page.locator(':focus').evaluate((el) => getComputedStyle(el).outlineStyle),
            ).not.toBe('none');
          }
          const option = page.locator(mode.selector);
          await option.focus();
          await option.press('Space');
          if (mode.marker) await expect(page.locator('html')).toHaveClass(new RegExp(mode.marker));
          await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
          if (mode.name === 'дислексия') {
            await page.evaluate(() => document.fonts.ready);
            for (const selector of ['#topbar button', '#view h1', '#view td', '#view svg text']) {
              const elements = page.locator(selector);
              if (await elements.count())
                expect(
                  await elements.first().evaluate((el) => getComputedStyle(el).fontFamily),
                ).toContain('adys');
            }
          }
          if (mode.name === 'текст') {
            await expect(page.locator('#view svg:visible')).toHaveCount(0);
            for (const table of await page.locator('details.fig-table').all()) {
              await expect(table).toHaveAttribute('open', '');
              await expect(table.locator('table')).toBeVisible();
            }
          }
          await page.keyboard.press('Escape');
          await expect(trigger).toBeFocused();
          await expect(trigger).toHaveAttribute('aria-expanded', 'false');
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          ).toBe(true);
          if (width === 360 && mode.name !== 'текст') {
            const buttonBox = await trigger.boundingBox();
            const tabBox = await page.locator('#tabbar').boundingBox();
            expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(tabBox!.y);
          }
          await page.reload();
          await expect(page.locator('.accessibility-controls')).toHaveCount(1);
          if (mode.marker) await expect(page.locator('html')).toHaveClass(new RegExp(mode.marker));
          await trigger.click();
          await page.locator('.a11y__item--clear button').click();
          await expect(page.locator('html')).not.toHaveClass(
            /dyslectic-font|font-resize|a11y-textonly|accessibility-(yellow|dark|blue)/,
          );
          expect(errors).toEqual([]);
          expect(
            await page.evaluate(
              () => (window as typeof window & { cspErrors?: string[] }).cspErrors ?? [],
            ),
          ).toEqual([]);
          if (path === '/' && mode.name === 'дислексия') {
            await page.locator(mode.selector).click();
            await page.keyboard.press('Escape');
            await info.attach(`panel-${width}`, {
              body: await page.screenshot({ fullPage: false, timeout: 15000 }),
              contentType: 'image/png',
            });
          }
        });
      }
    }
    test('text mode keeps chart data through navigation and restores layout', async ({
      page,
      visit,
    }) => {
      await visit('/dalg');
      await page.locator('.a11y-tools__button').click();
      await page.locator('.a11y__item--textonly button').click();
      await page.keyboard.press('Escape');
      if (width === 360)
        await page
          .locator('#footer details')
          .filter({ has: page.locator('a[href="/razhodi"]') })
          .locator('summary')
          .click();
      await page.locator('#footer a[href="/razhodi"]').first().click();
      await expect(page).toHaveURL(/\/razhodi/);
      await expect(page.locator('#view h1')).toBeVisible();
      await expect(page.locator('#view svg:visible')).toHaveCount(0);
      const tables = page.locator('details.fig-table');
      expect(await tables.count()).toBeGreaterThan(0);
      for (const table of await tables.all()) await expect(table.locator('table')).toBeVisible();
      const skip = page.getByRole('link', { name: 'Към съдържанието', exact: true });
      await skip.focus();
      await expect(skip).toBeVisible();
      await page.locator('.a11y-tools__button').click();
      await page.locator('.a11y__item--clear button').click();
      await expect(page.locator('html')).not.toHaveClass(/a11y-textonly/);
      await expect(page.locator('#topbar')).toBeVisible();
    });
    test('ADYS persists through application navigation', async ({ page, visit }) => {
      await visit('/');
      await page.locator('.a11y-tools__button').click();
      await page.locator('.a11y__item--dyslexic button').click();
      await page.keyboard.press('Escape');
      if (width === 360)
        await page
          .locator('#footer details')
          .filter({ has: page.locator('a[href="/rechnik"]') })
          .locator('summary')
          .click();
      await page.locator('#footer a[href="/rechnik"]').first().click();
      await expect(page).toHaveURL(/\/rechnik/);
      await expect(page.locator('#view h1')).toBeVisible();
      expect(
        await page.locator('#view h1').evaluate((el) => getComputedStyle(el).fontFamily),
      ).toContain('adys');
      await expect(page.locator('.accessibility-controls')).toHaveCount(1);
    });
  });
}
