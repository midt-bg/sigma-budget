import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { buildLaw } from './law.js';
const fixture = (name: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../../test/fixtures/law', name), 'utf8'));
it('builds the law dataset against the Python oracle', () =>
  expect(buildLaw(fixture('evidence.json'), '2026-11-08')).toEqual(fixture('oracle.json')));
it('rejects wrong dates', () => {
  const e = fixture('evidence.json');
  e.parliament.zdb.L_Act_date = '2026-07-02';
  expect(() => buildLaw(e, '2026-11-08')).toThrow();
});
it('checks the optional Parliament archive size when present', () => {
  const evidence = fixture('evidence.json');
  evidence.archiveBytes = 63_000_000;
  expect(() => buildLaw(evidence, '2026-11-08')).not.toThrow();
  evidence.archiveBytes = 62_500_000;
  expect(() => buildLaw(evidence, '2026-11-08')).toThrow();
});
