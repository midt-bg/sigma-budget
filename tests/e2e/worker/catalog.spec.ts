import { test, expect } from '../fixtures.ts';

test('catalogue contains only available datasets', async ({ page, siteURL }) => {
  await page.goto(siteURL + '/danni');
  const catalogue = page.locator('#s24-sets');
  await expect(catalogue).toBeVisible();
  await expect(catalogue).not.toContainText(/НЯМА ДАННИ|P02|P04|P07/i);
  await expect(
    catalogue.locator('[data-slug="p02"],[data-slug="p04"],[data-slug="p07"]'),
  ).toHaveCount(0);
});
