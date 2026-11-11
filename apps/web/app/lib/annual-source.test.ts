import { expect, it } from 'vitest';
import { annualSourceText } from '../../client/ui/annual-source.js';
it('limits the project/law warning to historical project figures', () => {
  for (const vintage of ['plan', 'draft', 'forecast']) {
    expect(
      annualSourceText({
        available: true,
        legacy: true,
        vintage,
        year: 2026,
        sourceRefs: ['asbp'],
      }),
    ).toContain('Приетият закон може да се различава от проекта');
  }
  expect(annualSourceText({ available: false })).toBe('');
});
it('uses the record publication date rather than a fixed acquisition date', () => {
  expect(
    annualSourceText({
      available: true,
      year: 2026,
      status: 'expected',
      sourceRefs: ['budget2027'],
      publication: '2026-11-07',
    }),
  ).toContain('07.11.2026');
});
