import { devices } from '@playwright/test';
import { test, expect } from '../fixtures.ts';

// Device emulation has no Android system bars or dynamic browser toolbar.
// These checks guard the visible layout; real-device scroll checks are still required.
for (const width of [360, 393, 412]) {
  test.describe(`mobile tabbar ${width}px`, () => {
    test.use({
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
      userAgent: devices['Pixel 7'].userAgent,
      viewport: { width, height: 800 },
    });
    test('stays at the bottom and leaves the final content reachable', async ({
      page,
      siteURL,
    }) => {
      await page.goto(siteURL + '/', { waitUntil: 'domcontentloaded' });
      await page.locator('article[data-ready="1"]').waitFor();
      const bar = page.getByRole('navigation', { name: 'Бърза навигация' });
      for (const height of [800, 700, 800]) {
        await page.setViewportSize({ width, height });
        for (const y of [0, 1200, 700]) {
          await page.evaluate((y) => scrollTo(0, y), y);
          await expect
            .poll(() =>
              bar.evaluate((el) => {
                const rect = el.getBoundingClientRect();
                return rect.top < innerHeight && rect.bottom >= innerHeight - 1;
              }),
            )
            .toBe(true);
          for (const link of await bar.getByRole('link').all()) {
            const rect = await link.boundingBox();
            expect(rect!.y).toBeGreaterThanOrEqual(0);
            expect(rect!.y + rect!.height).toBeLessThanOrEqual(height + 1);
          }
        }
      }
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const lastContent = page.locator('#view article').last();
      const footer = page.locator('.footer');
      await expect
        .poll(async () => {
          const top = (await bar.boundingBox())!.y;
          return lastContent.evaluate((el, top) => el.getBoundingClientRect().bottom <= top, top);
        })
        .toBe(true);
      // The last footer link must be clickable above the bar, too.
      const lastLink = footer.getByRole('link').last();
      const linkBounds = (await lastLink.boundingBox())!;
      expect(linkBounds.y + linkBounds.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
      expect(linkBounds.y).toBeGreaterThanOrEqual(0);
      expect(
        await lastLink.evaluate((link) => {
          const rect = link.getBoundingClientRect();
          return link.contains(
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
          );
        }),
        'the last footer link is not covered by fixed navigation',
      ).toBe(true);
    });
  });
}
