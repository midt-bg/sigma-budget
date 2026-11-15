import { evaluateProbe } from '../helpers.ts';
import { test, expect } from '../fixtures.ts';
import { VIEWS, CONTROLS_JS, VISIBLE_IDS_JS } from '../share-probes.ts';
import type { Page } from '@playwright/test';
test.use({
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
});
async function settle(page: Page) {
  await page.waitForSelector('h1', { timeout: 8000 });
  await page.waitForTimeout(700);
}
const linkFor = `async id => { const m = await import('./js/share.js'); const s = m.get(id); return s ? m.linkFor(s) : null; }`;
for (const view of VIEWS)
  test(`shared view ${view}`, async ({ context, page, browser, siteURL }) => {
    await context.addInitScript('window.__HASH_ROUTES__ = true');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    const base = siteURL + '/index.html';
    await page.goto(base + view);
    await settle(page);
    const original = await evaluateProbe<Record<string, string>>(page, CONTROLS_JS);
    const ids: string[] = await evaluateProbe(page, VISIBLE_IDS_JS);
    expect.soft(ids.length, `${view}: share menus`).toBeGreaterThan(0);
    const want = new URLSearchParams(view.split('?')[1] ?? '');
    for (const id of ids.slice(0, 6)) {
      const link: string | null = await evaluateProbe(page, linkFor, id);
      expect.soft(Boolean(link), `${view} [${id}]: link`).toBe(true);
      if (!link) continue;
      const hash = link.split('#')[1]!;
      const query = new URLSearchParams(hash.split('?')[1] ?? '');
      for (const [key, value] of want)
        expect.soft(query.get(key), `${view} [${id}] ?${key}`).toBe(value);
      const fresh = await browser.newContext({
        serviceWorkers: 'block',
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
      });
      try {
        await fresh.addInitScript('window.__HASH_ROUTES__ = true');
        const opened = await fresh.newPage();
        await opened.goto(base + '#' + hash);
        await settle(opened);
        const now = await evaluateProbe<Record<string, string>>(opened, CONTROLS_JS);
        for (const key of ['h1', 'fields', 'pressed'])
          expect.soft(now[key], `${view} [${id}] ${key}`).toBe(original[key]);
      } finally {
        await fresh.close();
      }
    }
    if (ids.length) {
      const button = page.locator(`[data-share="${ids[0]}"]`).first();
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await page.waitForSelector('[data-act]', { timeout: 3000 });
      const acts: string[] = await evaluateProbe(
        page,
        "() => [...document.querySelectorAll('[data-act]')].map(e => e.dataset.act)",
      );
      expect
        .soft(
          acts.every((a) => ['png', 'copy-link', 'csv', 'report'].includes(a)) &&
            acts.includes('png') &&
            acts.includes('copy-link'),
          `${view}: menu ${acts}`,
        )
        .toBe(true);
      await page.keyboard.press('Escape');
    }
    expect.soft(errors, `${view}: script errors`).toEqual([]);
  });
test('tax sharing never carries personal inputs', async ({ context, page, siteURL }) => {
  await context.addInitScript('window.__HASH_ROUTES__ = true');
  await page.goto(siteURL + '/index.html#/danaci?brutno=3000&zaplata=3000&demo=1');
  await settle(page);
  await page
    .locator('#s18-brutno, input[inputmode=decimal], input[type=text]')
    .first()
    .fill('3456');
  await page.waitForTimeout(500);
  expect.soft(await evaluateProbe(page, 'location.hash')).not.toContain('3456');
  const ids: string[] = await evaluateProbe(page, VISIBLE_IDS_JS);
  for (const id of ids) {
    const link: string | null = await evaluateProbe(page, linkFor, id);
    expect
      .soft(
        link !== null && !['brutno=', 'zaplata=', 'demo=', '3456'].some((k) => link.includes(k)),
        `danaci [${id}]: ${link}`,
      )
      .toBe(true);
  }
});
