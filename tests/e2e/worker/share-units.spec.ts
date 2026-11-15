import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../fixtures.ts';
test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });
for (const width of [1280, 390]) {
  test(`shared EUR/GDP views at ${width}px`, async ({ browser, siteURL }, testInfo) => {
    const contexts: BrowserContext[] = [],
      errors: string[] = [];
    async function fresh(saved = 'eur', javaScriptEnabled = true) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        javaScriptEnabled,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      contexts.push(context);
      if (javaScriptEnabled)
        await context.addInitScript(
          (unit) => localStorage.setItem('bns.prefs.v1', JSON.stringify({ unit })),
          saved,
        );
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      return page;
    }
    async function go(page: Page, path: string) {
      await page.goto(path.startsWith('http') ? path : siteURL + path);
      await page.locator('article[data-ready="1"]').waitFor();
    }
    async function chartUnit(page: Page, expected: string) {
      await page.waitForFunction(
        `async expected => { const spec = (await import('/js/ui/chart.js')).chartSpec('s13-rev-exp'); return !!spec && (expected === 'pct' ? spec.sub === '% от БВП' : spec.sub !== '% от БВП'); }`,
        expected,
      );
    }
    async function links(page: Page): Promise<Record<'full' | 'short' | 'embed', string>> {
      return page.evaluate(
        `(async () => { const s = await import('/js/share.js'); const spec = s.get('s13-b-rev-exp'); return { full:s.linkFor(spec), short:s.shortLink(spec), embed:s.embedHash(spec) }; })()`,
      );
    }
    try {
      const page = await fresh('eur');
      await go(page, '/prognoza?per=2029.forecast&unit=pct');
      await expect(page.locator('input[name="s13-unit"][value="pct"]')).toBeChecked();
      await chartUnit(page, 'pct');
      const ssr = await fresh('eur', false);
      await ssr.goto(page.url());
      await expect(ssr.locator('input[name="s13-unit"][value="pct"]')).toBeChecked();
      const shared = await links(page);
      for (const url of Object.values(shared))
        expect(new URL(url, siteURL).searchParams.getAll('unit')).toEqual(['pct']);
      const twin = await fresh('eur');
      await go(twin, shared.full);
      await expect(twin.locator('input[name="s13-unit"][value="pct"]')).toBeChecked();
      await chartUnit(twin, 'pct');
      const embed = await fresh('eur');
      await go(embed, shared.embed);
      await chartUnit(embed, 'pct');
      expect(
        new URL(
          (await embed.locator('.s29-brand').getAttribute('href'))!,
          siteURL,
        ).searchParams.getAll('unit'),
      ).toEqual(['pct']);
      await page.screenshot({
        path: testInfo.outputPath(`${width}-forecast-pct.png`),
        fullPage: true,
      });
      await page.locator('input[name="s13-unit"][value="eur"]').check();
      await page.waitForFunction("new URL(location.href).searchParams.get('unit') === 'eur'");
      await chartUnit(page, 'eur');
      const euros = await links(page),
        opposite = await fresh('pct');
      await go(opposite, euros.full);
      await expect(opposite.locator('input[name="s13-unit"][value="eur"]')).toBeChecked();
      await chartUnit(opposite, 'eur');
      const law = await fresh('eur');
      await go(law, '/zakon?unit=pct');
      await expect(law.locator('#s14-unit-pct')).toBeChecked();
      const noJsLaw = await fresh('eur', false);
      await noJsLaw.goto(law.url());
      await expect(noJsLaw.locator('#s14-unit-pct')).toBeChecked();
      await law.locator('#s14-unit-eur').check();
      await law.waitForFunction("new URL(location.href).searchParams.get('unit') === 'eur'");
      await expect(law.locator('#s14-unit-eur')).toBeChecked();
      await go(page, '/pari?unit=pct');
      await page.locator('article a[href^="/prihodi"]').first().click();
      await page.locator('article[data-ready="1"]').waitFor();
      expect(new URL(page.url()).searchParams.getAll('unit')).toEqual(['pct']);
      expect(await page.evaluate('document.documentElement.scrollWidth > innerWidth')).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      for (const context of contexts) await context.close();
    }
  });
}
