import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ROOT } from '../../apps/web/scripts/serve.ts';
import { deepPass, evaluate } from './screens-helpers.ts';
// An independent read of the published execution, as expect.plan()/compare() did.
interface Execution {
  latest: {
    month: number;
    asOf: string;
    kfp: Record<string, { cum: string | number; plan: string | number }>;
  };
  pace: Record<string, Record<string, number[]>>;
  data: Record<string, { kfp: Record<string, (string | number)[]> }>;
}
const ex: Execution = JSON.parse(readFileSync(join(ROOT, 'data/release/execution.json'), 'utf8'));
/** Python fixed-point formatting of the binary float: nearest, ties to even. */
function fixed(value: number, digits: number): string {
  if (!Number.isSafeInteger(digits) || digits < 0 || digits > 100)
    throw new RangeError('Invalid precision');
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(value));
  const bits = view.getBigUint64(0),
    exponent = Number((bits >> 52n) & 0x7ffn),
    fraction = bits & ((1n << 52n) - 1n);
  const mantissa = exponent === 0 ? fraction : fraction + (1n << 52n),
    shift = (exponent === 0 ? -1022 : exponent - 1023) - 52;
  let numerator = mantissa * 10n ** BigInt(digits),
    denominator = 1n;
  if (shift >= 0) numerator <<= BigInt(shift);
  else denominator <<= BigInt(-shift);
  let rounded = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n > denominator || (remainder * 2n === denominator && rounded % 2n === 1n))
    rounded++;
  const s = rounded.toString().padStart(digits + 1, '0'),
    sign = value < 0 || Object.is(value, -0) ? '-' : '';
  return sign + (digits ? `${s.slice(0, -digits)}.${s.slice(-digits)}` : s);
}
const num = (v: number, digits = 2, sign = false) => {
  const s = fixed(Math.abs(v), digits).replace('.', ',');
  return (v < 0 && Number(s.replace(',', '.')) !== 0 ? '−' : sign ? '+' : '') + s;
};
const planRows = ['rev', 'exp.total', 'exp.capex'];
const sums = planRows.map(
  (r) =>
    `${num(Number(ex.latest.kfp[r]!.cum) / 1000)} от ${num(Number(ex.latest.kfp[r]!.plan) / 1000)}`,
);
const current = planRows.map(
  (r) => num((Number(ex.latest.kfp[r]!.cum) / Number(ex.latest.kfp[r]!.plan)) * 100, 1) + '%',
);
const previous = planRows.map((r) => num(ex.pace['2025']![r]![ex.latest.month - 1]!, 1) + '%');
const compareRows = ['rev', 'exp.total', 'balance'];
const year = Number(ex.latest.asOf.slice(0, 4));
const a = compareRows.map((r) => Number(ex.data[String(year - 1)]!.kfp[r]![ex.latest.month - 1]!));
const b = compareRows.map((r) => Number(ex.data[String(year)]!.kfp[r]![ex.latest.month - 1]!));
export const VALUE_CHECKS: Record<string, { all: string[]; needs?: string }> = {
  S01: {
    all: [
      'Държавният бюджет на достъпен език',
      'Разгледай бюджета за 5 минути',
      'Изпълнение на плана за 2026 г.',
      'Приходи',
      'Разходи с вноската в ЕС',
      'Капиталови разходи',
      ...current,
      ...previous,
      ...sums.map((s) => s + ' млрд. €'),
      'Виж приходите и разходите по проекта за 2027 г. и прогнозата до 2029 г., както и изпълнението за 2026 г.',
      'Откъде идват парите?',
      'За какво се харчат?',
      'Изпълнява ли се планът?',
      'Колко плащам аз?',
      'Кой харчи парите?',
      'Колко е държавният дълг?',
      'Какво се променя?',
      'Накъде върви бюджетът?',
    ],
  },
  S15: {
    all: [
      ...a.map((v) => num(v / 1000)),
      ...b.map((v) => num(v / 1000)),
      ...[0, 1].map((i) => num((b[i]! - a[i]!) / 1000, 2, true)),
      'дефицит',
    ],
  },
  S18: { all: ['1 500'], needs: 'rates.json' },
};
const viewText = async (page: Page) =>
  (
    await evaluate<string>(
      page,
      "() => (document.getElementById('view') || document.body).textContent || ''",
    )
  ).replace(/[\u00a0\u2007\u2009\u202f]/g, ' ');
export async function valueScan(page: Page, route: string, pending: Set<string>, didDeep = false) {
  const spec = VALUE_CHECKS[route];
  if (!spec || (spec.needs && pending.has(spec.needs))) return null;
  let text = await viewText(page);
  let found = spec.all.filter((v) => text.includes(v));
  if (found.length < spec.all.length && !didDeep) {
    await deepPass(page);
    text = await viewText(page);
    found = spec.all.filter((v) => text.includes(v));
  }
  return { want: [...spec.all], found };
}
