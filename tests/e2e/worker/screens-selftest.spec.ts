import { test, expect, openScreen } from '../screens/fixtures.ts';
import { auditScreen, screenReady } from '../screens/browser.ts';
test.use({ expectedBrowserErrors: ['console-error', 'pageerror', 'request-failed'] });
const codes = [
  'frame',
  'route',
  'h1',
  'title',
  'lang',
  'landmark',
  'layout',
  'tokens',
  'placeholder',
  'encoding',
  'scroll-x',
  'a11y-name',
  'a11y-label',
  'a11y-alt',
  'aria-ref',
  'aria-hidden-focus',
  'a11y-structure',
  'dead-link',
  'img-broken',
  'tabs',
  'target-size',
  'tiny-text',
  'src-key',
  'pending-id',
  'gl-term',
  'share-id',
  'fig-table',
  'mock-marker',
  'chart',
  'next',
  'link-route',
  'csp',
  'rejection',
];
test('screen audit detects visible defects and a busy screen times out', async ({
  page,
  siteURL,
}) => {
  test.setTimeout(150_000);
  await openScreen(page, siteURL, '#/');
  await page.evaluate(() => {
    const view = document.getElementById('view')!;
    view.setAttribute('aria-busy', 'true');
  });
  await expect(page.waitForFunction(screenReady, undefined, { timeout: 500 })).rejects.toThrow(
    /Timeout/,
  );
  await page.evaluate(() => {
    document.getElementById('view')!.removeAttribute('aria-busy');
    document.querySelector<HTMLElement>('article.page')!.dataset.ready = '0';
    document.title = 'СИГМА Бюджет';
    document.documentElement.lang = 'en';
    document.querySelector('.skip-link')!.remove();
    document.getElementById('topbar')!.hidden = true;
    document.querySelector('h1')!.textContent = '';
    const defects = document.createElement('section');
    defects.innerHTML = `<p>NaN lorem ipsum �</p><div style="width:3000px;height:4px"></div>
      <button></button><input><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
      <p aria-labelledby="missing-label">Missing label</p><div aria-hidden="true"><button>Hidden control</button></div>
      <details>Missing summary</details><a href="#">Dead link</a>
      <div role="tablist"><button role="tab" aria-selected="true" aria-controls="missing-panel">Tab</button></div>
      <button aria-label="small a" style="width:10px;height:10px;padding:0;display:inline-block"></button><button aria-label="small b" style="width:10px;height:10px;padding:0;display:inline-block"></button>
      <p style="font-size:9px">Tiny text</p><span data-src="missing-source">Source</span><span data-pending-id="missing-pending">Pending</span>
      <a data-gl="missing-term" href="#/rechnik">Unknown term</a><button data-share="missing-share">Share</button>
      <figure class="fig" data-mock-fig="true"></figure><div class="chart" data-ready="err" style="width:200px;height:100px"></div>
      <aside class="next"></aside><a href="#/missing-route-for-audit">Missing destination</a>`;
    document.getElementById('view')!.append(defects);
    const script = document.createElement('script');
    script.textContent = 'void 0';
    document.body.append(script);
    void Promise.reject(new Error('Deliberate audit rejection'));
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => window.screenEvents.csp.length > 0 && window.screenEvents.rejections.length > 0,
      ),
    )
    .toBe(true);
  const findings = await page.evaluate(auditScreen, 'missing-route');
  expect(
    codes.filter((code) => !findings.some((finding) => finding.code === code)),
    'Undetected defect codes',
  ).toEqual([]);
});
