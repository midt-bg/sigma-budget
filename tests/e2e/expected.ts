import { readFileSync } from 'node:fs';

// Independent oracle: only published JSON is read, never application calculation/formatting code.
type Execution = {
  latest: { month: number; asOf: string; kfp: Record<string, { cum: string; plan: string }> };
  pace: Record<string, Record<string, number[]>>;
  data: Record<string, Record<string, Record<string, string[]>>>;
};
export const execution: Execution = JSON.parse(
  readFileSync(new URL('../../data/release/execution.json', import.meta.url), 'utf8'),
);
export function releaseNumber(value: unknown): number {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' &&
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()))
  )
    throw new Error('Missing or invalid release number');
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Non-finite release number');
  return parsed;
}
export function formatNumber(v: number, d = 2, sign = false) {
  const s = Math.abs(v).toFixed(d).replace('.', ',');
  return (v < 0 && Number(s.replace(',', '.')) !== 0 ? '−' : sign ? '+' : '') + s;
}
export function expectedPlan() {
  const { month, kfp } = execution.latest;
  const rows = ['rev', 'exp.total', 'exp.capex'];
  const cur = rows.map((r) => (releaseNumber(kfp[r]!.cum) / releaseNumber(kfp[r]!.plan)) * 100);
  const prev = rows.map((r) => execution.pace['2025']![r]![month - 1]!);
  const bars = cur.flatMap((v, i) => [v, prev[i]!]);
  return {
    month,
    sums: rows.map(
      (r) =>
        `${formatNumber(releaseNumber(kfp[r]!.cum) / 1000)} от ${formatNumber(releaseNumber(kfp[r]!.plan) / 1000)}`,
    ),
    cur: cur.map((v) => formatNumber(v, 1) + '%'),
    prev: prev.map((v) => formatNumber(v, 1) + '%'),
    bars: bars.map((v) => formatNumber(v, 1) + '%'),
    widths: bars.map((v) => Number(v.toFixed(1)) + '%'),
  };
}
export function cumulativeValue(year: number, scope: string, row: string, month: number) {
  return releaseNumber(execution.data[String(year)]![scope]![row]![month - 1]!);
}
export function executionValue(
  year: number,
  scope: string,
  row: string,
  month: number,
  mode: string,
) {
  return (
    cumulativeValue(year, scope, row, month) -
    (mode === 'kum' || month === 1 ? 0 : cumulativeValue(year, scope, row, month - 1))
  );
}
export function expectedComparison() {
  const { month, asOf } = execution.latest;
  const y = Number(asOf.slice(0, 4));
  const rows = ['rev', 'exp.total', 'balance'];
  const a = rows.map((r) => cumulativeValue(y - 1, 'kfp', r, month));
  const b = rows.map((r) => cumulativeValue(y, 'kfp', r, month));
  return {
    prev: a.map((v) => formatNumber(v / 1000)),
    cur: b.map((v) => formatNumber(v / 1000)),
    diff: [0, 1].map((i) => formatNumber((b[i]! - a[i]!) / 1000, 2, true)),
    balanceDiff: formatNumber(Math.abs(b[2]! - a[2]!) / 1000),
  };
}

type Employment = {
  employeePct: number;
  employerPctWithoutTzpb: number;
  incomeTaxPct: number;
  tzpbPct: { min: number; max: number; used: number };
  maxInsurableIncomeEur: { id: string; eur: number }[];
};
const rates = JSON.parse(
  readFileSync(new URL('../../data/release/rates.json', import.meta.url), 'utf8'),
);
const employment: Employment = rates.scenarios.find((s: { id: string }) => s.id === 'employment');
export const insurableIncomeCaps = Object.fromEntries(
  employment.maxInsurableIncomeEur.map((m) => [m.id, m.eur]),
);
// All monetary calculations use integer cents; rates use basis points.
export function salaryModel(gross: string, rule: string, tzpb?: number) {
  const grossCents = Math.round(Number(gross) * 100);
  const basisPoints = (percent: number) => Math.round(percent * 100);
  const accidentRate = Math.min(
    Math.max(tzpb ?? employment.tzpbPct.used, employment.tzpbPct.min),
    employment.tzpbPct.max,
  );
  function month(period: string) {
    const insured = Math.min(grossCents, Math.round(insurableIncomeCaps[period]! * 100));
    const emp = Math.round((insured * basisPoints(employment.employeePct)) / 10_000);
    const tax = Math.round(((grossCents - emp) * basisPoints(employment.incomeTaxPct)) / 10_000);
    const er = Math.round(
      (insured * (basisPoints(employment.employerPctWithoutTzpb) + basisPoints(accidentRate))) /
        10_000,
    );
    return { emp, tax, er };
  }
  const periods =
    rule === 'year'
      ? ([
          [month('until'), 7],
          [month('from'), 5],
        ] as const)
      : ([[month(rule), 12]] as const);
  const yearly = (key: 'emp' | 'tax' | 'er') =>
    periods.reduce((sum, [amount, months]) => sum + amount[key] * months, 0);
  const yEmp = yearly('emp'),
    yTax = yearly('tax'),
    yEr = yearly('er');
  const emp = Math.round(yEmp / 12),
    tax = Math.round(yTax / 12),
    er = Math.round(yEr / 12);
  return {
    emp: emp / 100,
    tax: tax / 100,
    er: er / 100,
    net: (grossCents - emp - tax) / 100,
    yEmp: yEmp / 100,
    yTax: yTax / 100,
    yEr: yEr / 100,
  };
}
