import { test, expect, openScreen } from '../screens/fixtures.ts';
import { routes, displays } from '../screens/cases.ts';
import { NAV_GROUPS } from '../../../apps/web/client/chrome.js';

for (const display of displays)
  test.describe(display, () => {
    test.use({ display });
    test('client navigation and browser history', async ({ page, siteURL }) => {
      await openScreen(page, siteURL, '#/');
      let previous = await page.title();
      const visited: { url: string; title: string; heading: string }[] = [];
      // The menu covers all public sections. Detail screens are reached through their parent links.
      for (const route of routes.filter((r) => r.nav && r.id !== 'S01')) {
        await page.evaluate(() => scrollTo(0, 400));
        if (display === 'touch')
          await page.getByRole('button', { name: 'Меню', exact: true }).click();
        else {
          const group = NAV_GROUPS.find(([, ids]) => ids.includes(route.id))!;
          await page
            .getByRole('navigation', { name: 'Основна навигация', exact: true })
            .getByRole('button', { name: group[0], exact: true })
            .click();
        }
        await page
          .getByRole('dialog')
          .filter({ visible: true })
          .getByRole('link', { name: route.short || route.title, exact: true })
          .click();
        const heading = page.getByRole('heading', { level: 1 });
        await expect(heading).toHaveCount(1);
        await expect(heading).toHaveText(route.title);
        await expect(page).toHaveTitle(`${route.title} · СИГМА Бюджет`);
        expect(await page.title()).not.toBe(previous);
        await expect(heading).toBeFocused();
        await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
        const period = page.getByRole('button', { name: /^Година и статус на данните:/ });
        if (route.periods === 'none') await expect(period).toBeHidden();
        else await expect(period).toBeVisible();
        previous = await page.title();
        visited.push({ url: page.url(), title: previous, heading: route.title });
      }
      let index = visited.length - 1;
      for (const direction of ['back', 'back', 'back', 'forward', 'forward']) {
        if (direction === 'back') {
          await page.goBack();
          index--;
        } else {
          await page.goForward();
          index++;
        }
        const wanted = visited[index]!;
        await expect(page).toHaveURL(wanted.url);
        await expect(page).toHaveTitle(wanted.title);
        await expect(
          page.getByRole('heading', { level: 1, name: wanted.heading, exact: true }),
        ).toBeFocused();
      }
    });
  });
