import { test, expect } from '../fixtures.ts';
test.use({ serviceWorkers: 'block' });
import { checkChrome } from '../chrome-adoption.ts';
// mockbar/button was removed in 8bad49c0; bannerHtml() now returns null.
for (const [root, selector] of [
  ['footer', 'a'],
  ['tabbar', 'a'],
] as const)
  test(`chrome adoption retains ${root} nodes and focus`, async ({ page, siteURL }) => {
    await checkChrome(page, siteURL, root, selector);
  });
import type { Page } from '@playwright/test';
function observeErrors(page: Page, base: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    const expected404 =
      m.location().url === base + '/nyama-takava-stranitsa' && m.text().includes('status of 404');
    if (m.type() === 'error' && !expected404) errors.push(m.text());
  });
  return errors;
}
test('redirect, editorial seed, four anchors, history and 404 search', async ({
  page,
  siteURL,
}) => {
  // browser.new_page() here originally used 1280 × 720.
  const errors = observeErrors(page, siteURL),
    requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(`document.addEventListener('readystatechange', () => {
    if(document.readyState === 'interactive') window.initialHeading = document.querySelector('h1');
  });`);
  let response = await page.goto(siteURL + '/za-proekta?to=s26-legend');
  expect(response!.status()).toBe(200);
  expect(new URL(response!.url()).pathname).toBe('/danni');
  expect(new URL(response!.url()).search).toBe('');
  expect((await response!.request().redirectedFrom()!.response())!.status()).toBe(301);
  await page.waitForSelector('article[data-route="S24"][data-ready="1"]');
  requests.length = 0;
  response = await page.goto(siteURL + '/api');
  expect(response!.status()).toBe(200);
  await page.waitForSelector('article.page[data-ready="1"]');
  expect(await page.evaluate('window.initialHeading === document.querySelector("h1")')).toBe(true);
  expect(
    requests.filter(
      (url) => url.includes('/data/core.json') || url.includes('/data/glossary.json'),
    ),
  ).toEqual([]);
  const anchors = await page
    .locator('nav.s25-toc a[href]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!));
  expect(anchors).toHaveLength(4);
  for (const address of anchors) {
    const target = new URL(address, siteURL).searchParams.get('to');
    await page.locator(`nav.s25-toc a[href="${address}"]`).click();
    await page.waitForFunction((id) => {
      const h = document.getElementById(id!);
      if (!h || document.activeElement !== h) return false;
      const rect = h.getBoundingClientRect();
      return rect.top >= 0 && rect.top < innerHeight && h.classList.contains('hl');
    }, target);
  }
  await page.locator('a[href="/prihodi"]').first().click();
  await page.waitForSelector('article[data-route="S06"][data-ready="1"]');
  await page.goBack();
  await page.waitForSelector('article[data-route="S25"][data-ready="1"]');
  response = await page.goto(siteURL + '/nyama-takava-stranitsa');
  expect(response!.status()).toBe(404);
  await page.waitForSelector('article[data-route="S30"][data-ready="1"]');
  expect(await page.evaluate('window.initialHeading === document.querySelector("h1")')).toBe(true);
  await page.fill('#s30-q', '  ДДС   бюджет  ');
  await page.locator('.s30-go').click();
  await page.waitForSelector('article[data-route="S28"][data-ready="1"]');
  expect(page.url()).toContain('q=%D0%94%D0%94%D0%A1+');
  expect(errors).toEqual([]);
});
