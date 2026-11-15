import { test } from '../fixtures.ts';
import { checkChrome } from '../chrome-adoption.ts';
test.use({ serviceWorkers: 'block' });
// Manual follow-up: React removes the server-generated image preload link on refresh.
test('topbar preserves every SSR node', async ({ page, siteURL }) => {
  await checkChrome(page, siteURL, 'topbar', '.brand');
});
