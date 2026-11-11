import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage } from './check-coverage.mjs';
const baseline = { tolerance: 0.5, workspaces: { 'apps/web': { lines: 80, branches: 70 } } };
const reports = (pct) => ({
  'apps/web': {
    total: Object.fromEntries(
      ['lines', 'branches', 'functions', 'statements'].map((m) => [m, { pct }]),
    ),
  },
});
test('boundary passes; regression and missing reports fail', () => {
  assert.deepEqual(checkCoverage(baseline, reports(79.5), []), []);
  assert.equal(checkCoverage(baseline, reports(79.49), []).length, 1);
  assert.equal(checkCoverage(baseline, {}, []).length, 4);
  assert.equal(checkCoverage(baseline, reports(NaN), []).length, 4);
});
test('reviewed exceptions are scoped, bounded and expire', () => {
  const e = {
    workspace: 'apps/web',
    metric: 'lines',
    minimum: 75,
    reason: 'Reviewed migration',
    review: 'https://github.com/midt-bg/sigma-budget/pull/1',
    expires: '2026-12-01',
  };
  assert.deepEqual(checkCoverage(baseline, reports(75), [e], '2026-11-11'), []);
  assert.equal(checkCoverage(baseline, reports(74), [e], '2026-11-11').length, 1);
  for (const change of [
    { review: '' },
    { reason: '' },
    { minimum: -1 },
    { workspace: 'apps/missing' },
    { expires: '2026-01-01' },
    { expires: '2026-99-99' },
  ]) {
    assert.throws(() => checkCoverage(baseline, reports(75), [{ ...e, ...change }], '2026-11-11'));
  }
  assert.throws(() => checkCoverage(baseline, reports(75), [e, e], '2026-11-11'));
});

test('the documented tolerance cannot be silently widened', () => {
  assert.throws(() => checkCoverage({ ...baseline, tolerance: 1 }, reports(79.4), []));
});
