import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  parseDebtStructure,
  parseDebtInterest,
  parseGuaranteedDebt,
  parseNewDebt,
  parseDebtLawLimits,
} from './debt-text.js';
import type { CleanPage } from './fiscal.js';
const root = resolve(import.meta.dirname, '../../test/fixtures/fiscal');
const read = (name: string) => JSON.parse(readFileSync(resolve(root, name), 'utf8'));
const pages = (): CleanPage[] =>
  read('inputs/data/cache/research/mf-umtbf-2026-2028/extracts/pdf_pages_clean.json');
it('matches the cleaned debt-text Python readers', () => {
  const p = pages();
  const blocks = read('inputs/dv-blocks.json').zdb as [string, string][];
  expect({
    structure: parseDebtStructure(p),
    interest: parseDebtInterest(p),
    guaranteed: parseGuaranteedDebt(p),
    newDebt: parseNewDebt(p),
    lawLimits: parseDebtLawLimits(blocks.filter(([kind]) => kind === 'p').map(([, text]) => text)),
  }).toEqual(read('debt-text-oracle.json'));
});
it('rejects changed and duplicated evidence', () => {
  const p = pages();
  p.find((x) => x.page === 143)!.body = p
    .find((x) => x.page === 143)!
    .body.replace('39,4%', 'missing');
  expect(() => parseDebtStructure(p)).toThrow(/no longer repeats/);
  const q = pages();
  q.find((x) => x.page === 144)!.body += '\n' + q.find((x) => x.page === 144)!.body;
  expect(() => parseDebtInterest(q)).toThrow(/matched 2 times/);
});
