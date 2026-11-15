import { test, evaluate, expect, audit, collect, problemFindings } from '../screens-helpers.ts';
import { SELFTEST_JS } from '../screens-scripts.ts';
test.use({ serviceWorkers: 'block' });
const AUDIT_CODES = [
  'tokens',
  'scroll-x',
  'a11y-name',
  'link-route',
  'dup-id',
  'contrast',
  'chart',
  'a11y-alt',
  'src-key',
  'gl-term',
  'h1',
  'placeholder',
  'a11y-label',
  'public-leak',
  'english-text',
  'tiny-text',
  'target-size',
  'csp',
];
const PROBE_CODES = ['console', 'exception', 'dialog', 'http-404', 'pending-data', 'cookie'];
test('screen audit and browser probe detect planted defects', async ({ screens, discovery }) => {
  void discovery;
  const o = await screens.open('1280-light');
  expect(o.ok, o.why).toBe(true);
  o.probe.reset();
  await evaluate(o.page, SELFTEST_JS);
  await o.page.waitForTimeout(600);
  const result = await audit(o.page, 'S01');
  const got = new Set([...problemFindings(result), ...(await collect(o))].map((f) => f.code));
  expect(
    [...AUDIT_CODES, ...PROBE_CODES].filter((code) => !got.has(code)).sort(),
    'the checker no longer detects these codes',
  ).toEqual([]);
});
