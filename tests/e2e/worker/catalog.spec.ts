import { test, expect } from '../fixtures.ts';

for (const [path, selector] of [
  ['/danni', '#s24-sets'],
  ['/proverka', '#s35-sets'],
]) {
  test(`${path} contains only available datasets`, async ({ page, siteURL }) => {
    await page.goto(siteURL + path);
    const catalogue = page.locator(selector!);
    await expect(catalogue).toBeVisible();
    await expect(catalogue).not.toContainText(/НЯМА ДАННИ|P02|P04|P07/i);
    await expect(
      catalogue.locator('[data-slug="p02"],[data-slug="p04"],[data-slug="p07"]'),
    ).toHaveCount(0);
  });
}
