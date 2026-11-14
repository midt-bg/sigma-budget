// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import * as share from '../../client/share.js';
import { debtIssues } from '../../client/ui/debt-issues.js';
it('shows the dated nominal snapshot, a maturity chart/table and unconverted USD', () => {
  const data = JSON.parse(
    readFileSync(new URL('../../../../data/release/debt-issues.json', import.meta.url), 'utf8'),
  );
  const spy = vi.spyOn(share, 'attach');
  const text = String(debtIssues({ data: { 'debt-issues': data } }));
  expect(text).toContain('30.09.2026');
  expect(text).toContain('предварителни данни');
  expect(text).toContain('USD');
  expect(text).toContain('не е превалутирана');
  expect(text).toContain('debt-issues-maturity');
  expect(text).toContain('debt-issues-auctions');
  expect(text).toContain('Падеж');
  expect(text).toContain('—');
  const table = spy.mock.calls.find(([id]) => id === 'debt-issues-outstanding')![1] as {
    table: () => { rows: unknown[][] };
  };
  expect(table.table().rows).toHaveLength(30);
  const rows = table.table().rows;
  const usd = rows.find((r) => String(r[0]).includes('XS2890436087'))!;
  expect(usd[1]).toBe('USD');
  expect(text).not.toMatch(/undefined|\[object Object\]/);
  spy.mockRestore();
  expect(debtIssues({ data: {} })).toBe('');
});
