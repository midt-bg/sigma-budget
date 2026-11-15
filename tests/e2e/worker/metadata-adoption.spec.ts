import { test, expect } from '../fixtures.ts';
// browser.new_page() in the original allowed service workers and used 1280 × 720.
test.use({ serviceWorkers: 'allow' });
for (const path of ['/api', '/api?set=execution', '/api?set=ministries-programs', '/proverka']) {
  test(`metadata adopts server article: ${path}`, async ({ page, siteURL }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(
      `window.firstArticle=null;new MutationObserver(()=>{window.firstArticle ||= document.querySelector('article.page');}).observe(document,{subtree:true,childList:true});`,
    );
    await page.goto(siteURL + path);
    await page.waitForSelector('article[data-ready="1"]');
    expect(
      await page.evaluate('window.firstArticle === document.querySelector("article.page")'),
    ).toBe(true);
    if (path === '/api?set=ministries-programs') {
      await expect(page.locator('#s25-d-meta')).toHaveCount(1);
      await expect(page.locator('#s25-c-js')).toContainText('res.json()');
    }
    expect(errors).toEqual([]);
  });
}
test('catalogue selection changes query once and retains focus', async ({ page, siteURL }) => {
  await page.goto(siteURL + '/api');
  await page.waitForSelector('article[data-ready="1"]');
  await page.evaluate(`(() => {
    window.catalogueQueryCalls = [];
    const replace = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      if (new Error().stack.includes('setQuery')) window.catalogueQueryCalls.push(args[2]);
      return replace(...args);
    };
  })()`);
  await page.locator('#s25-set').focus();
  await page.locator('#s25-set').selectOption('execution');
  await page.waitForFunction(
    `() => document.querySelector('#s25-addr')?.textContent.endsWith('/execution.json') && document.querySelector('article')?.dataset.ready === '1'`,
  );
  await page.evaluate(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
  expect(await page.evaluate('window.catalogueQueryCalls.length')).toBe(1);
  await expect(page.locator('#s25-set')).toBeFocused();
});
