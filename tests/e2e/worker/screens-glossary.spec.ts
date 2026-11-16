import { test, expect, openScreen } from '../screens/fixtures.ts';
import { displays } from '../screens/cases.ts';
import { fitsViewport } from '../screens/interactions.ts';
import glossary from '../../../data/release/glossary.json' with { type: 'json' };

const titleOf = (t: (typeof glossary.terms)[number]) =>
  t.abbr ? `${t.name} – ${t.abbr}` : t.title || t.name || t.slug;
for (const display of displays)
  test.describe(display, () => {
    test.use({ display });
    test('glossary in context', async ({ page, siteURL }) => {
      await openScreen(page, siteURL, '#/5-minuti');
      const opener = page.locator('#view').getByRole('link', { name: 'ДДС', exact: true }).first();
      const term = glossary.terms.find((t) => t.slug === 'dds')!;
      const original = page.url();
      for (const method of ['click', 'Enter']) {
        if (method === 'click') await opener.click();
        else {
          await opener.focus();
          await opener.press('Enter');
        }
        const dialog = page.getByRole('dialog', { name: `Речник: ${titleOf(term)}`, exact: true });
        await fitsViewport(dialog);
        await expect(dialog.getByText(term.def, { exact: true })).toBeVisible();
        expect(page.url()).toBe(original);
        const related = glossary.terms.find((t) => t.slug === term.related[0]!.slug)!;
        await dialog.getByRole('link', { name: related.name, exact: true }).click();
        const next = page.getByRole('dialog', { name: `Речник: ${titleOf(related)}`, exact: true });
        await expect(next.getByText(related.def, { exact: true })).toBeVisible();
        await next.getByRole('button', { name: `← ${titleOf(term)}`, exact: true }).click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
        expect(page.url()).toBe(original);
        const before = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, 200);
        await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(before);
      }
      await opener.click();
      await page.getByRole('link', { name: /Пълно обяснение в речника/ }).click();
      await expect(page).toHaveURL(/\/rechnik\/dds/);
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    });
  });
