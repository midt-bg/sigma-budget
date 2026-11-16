import { test, expect, openScreen } from '../screens/fixtures.ts';
import { withQuery } from '../screens/cases.ts';
import { drawn } from '../screens/interactions.ts';

const cases = [
  { address: '#/prihodi', id: 's06-view', query: 'izgled' },
  { address: '#/vedomstva', id: 's10-tabs', query: 'tab' },
  { address: '#/merki?per=2026.law', id: 's12-lists', query: 'spisak' },
  { address: '#/merki?per=2027.draft', id: 's12-2027-tabs', query: 'spisak' },
  { address: '#/vrazka', id: 's27-tabs', query: 'tab' },
];
for (const entry of cases)
  test(`tabs ${entry.address}`, async ({ page, siteURL }) => {
    await openScreen(page, siteURL, entry.address);
    // The public tab list is unique on each of these screens.
    const list = page.getByRole('tablist');
    const names = await list.getByRole('tab').allTextContents();
    const values = await list
      .getByRole('tab')
      .evaluateAll((tabs) => tabs.map((tab) => (tab as HTMLElement).dataset.key!));
    for (let i = 0; i < names.length; i++) {
      const tab = list.getByRole('tab', { name: names[i]!.trim(), exact: true });
      await tab.scrollIntoViewIfNeeded();
      const y = await page.evaluate(() => scrollY);
      await tab.click();
      const panel = page.getByRole('tabpanel', { name: names[i]!.trim(), exact: true });
      await drawn(panel);
      await expect
        .poll(() => new URLSearchParams(page.url().split('?')[1]).get(entry.query))
        .toBe(values[i]);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
    }
    const last = list.getByRole('tab', { name: names.at(-1)!.trim(), exact: true });
    await last.focus();
    await last.press('ArrowRight');
    await expect(list.getByRole('tab', { name: names[0]!.trim(), exact: true })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: names[0]!.trim(), exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('tabpanel', { name: names[0]!.trim(), exact: true })).toBeVisible();
    await openScreen(page, siteURL, withQuery(entry.address, { [entry.query]: 'unknown' }));
    await expect(page.getByRole('tabpanel', { name: names[0]!.trim(), exact: true })).toBeVisible();
  });
