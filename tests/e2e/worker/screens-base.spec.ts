import { test, expect, openScreen, deepPass } from '../screens/fixtures.ts';
import { auditScreen } from '../screens/browser.ts';
import { auditCases, routes } from '../screens/cases.ts';
import { VALUE_CHECKS, visibleValues } from '../screens-values.ts';
for (const entry of auditCases)
  test.describe(`${entry.route} ${entry.display} ${entry.address}`, () => {
    test.use({ display: entry.display, routeId: entry.route });
    test('screen audit', async ({ page, siteURL }) => {
      test.setTimeout(150_000);
      await openScreen(page, siteURL, entry.address);
      expect(await page.evaluate(auditScreen, entry.route), 'Initial screen audit').toEqual([]);
      await deepPass(page);
      expect(await page.evaluate(auditScreen, entry.route), 'Expanded screen audit').toEqual([]);
    });
  });
for (const route of routes.filter((route) => VALUE_CHECKS[route.id]))
  test.describe(`published values ${route.id}`, () => {
    test.use({ routeId: route.id });
    test('published text', async ({ page, siteURL, missingData }) => {
      test.setTimeout(150_000);
      const found = new Set<string>();
      for (const address of route.samples) {
        await openScreen(page, siteURL, address);
        await deepPass(page);
        for (const value of await visibleValues(page, route.id, missingData)) found.add(value);
      }
      const expected = VALUE_CHECKS[route.id]!;
      if (expected.needs && missingData.has(expected.needs)) return;
      expect(
        expected.all.filter((value) => !found.has(value)),
        `Published values missing on ${route.id}`,
      ).toEqual([]);
    });
  });
