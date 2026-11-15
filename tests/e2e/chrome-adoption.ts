import type { Page } from '@playwright/test';
import { expect } from './fixtures.ts';
export async function checkChrome(page: Page, siteURL: string, root: string, selector: string) {
  await page.setViewportSize({ width: root === 'tabbar' ? 390 : 1280, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/js/react-bridge.js', async (route) => {
    await page.evaluate(`(({root, selector}) => {
        window.chromeFocus = document.querySelector(\`#\${root} \${selector}\`);
        window.chromeNodes = [...document.querySelectorAll(\`#\${root} *\`)];
        window.chromeFocus.focus();
        if (document.activeElement !== window.chromeFocus) throw new Error('SSR control did not receive focus');
      })(${JSON.stringify({ root, selector })})`);
    await route.continue();
  });
  await page.goto(siteURL + '/prihodi');
  await page.waitForSelector('article.page[data-ready="1"]');
  expect(
    await page.evaluate(
      'window.chromeFocus?.isConnected && document.activeElement === window.chromeFocus',
    ),
  ).toBe(true);
  await page.evaluate("import('/js/shell.js').then(module => module.shell.refreshFooter())");
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(
      'window.chromeFocus?.isConnected && document.activeElement === window.chromeFocus',
    ),
  ).toBe(true);
  expect(
    await page.evaluate(`(root => {
      const nodes = [...document.querySelectorAll(\`#\${root} *\`)];
      return nodes.length === window.chromeNodes.length && nodes.every((node, i) => node === window.chromeNodes[i]);
    })(${JSON.stringify(root)})`),
  ).toBe(true);
  expect(errors).toEqual([]);
}
