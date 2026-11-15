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
// Python %.nf / round use ties-to-even on the exact binary float, unlike JS toFixed.
// Decode that float so multiplication cannot manufacture or erase a halfway case.
function fixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) throw new Error('Expected a finite release number');
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, Math.abs(value));
  const bits = view.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const fraction = bits & ((1n << 52n) - 1n);
  const significand = exponent === 0 ? fraction : (1n << 52n) | fraction;
  const power = (exponent === 0 ? -1022 : exponent - 1023) - 52;
  let numerator = significand * 10n ** BigInt(decimals);
  if (power > 0) numerator <<= BigInt(power);
  const denominator = power < 0 ? 1n << BigInt(-power) : 1n;
  let units = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder * 2n > denominator || (remainder * 2n === denominator && units % 2n !== 0n))
    units++;
  const digits = String(units).padStart(decimals + 1, '0');
  return decimals ? digits.slice(0, -decimals) + '.' + digits.slice(-decimals) : digits;
}
export function pythonRound(value: number, decimals = 2) {
  return Number((value < 0 || Object.is(value, -0) ? '-' : '') + fixed(value, decimals));
}
export function num(v: number, d = 2, sign = false) {
  const s = fixed(v, d).replace('.', ',');
  return (v < 0 && Number(s.replace(',', '.')) !== 0 ? '−' : sign ? '+' : '') + s;
}
export function plan() {
  const { month, kfp } = execution.latest;
  const rows = ['rev', 'exp.total', 'exp.capex'];
  const cur = rows.map((r) => (Number(kfp[r]!.cum) / Number(kfp[r]!.plan)) * 100);
  const prev = rows.map((r) => execution.pace['2025']![r]![month - 1]!);
  const bars = cur.flatMap((v, i) => [v, prev[i]!]);
  return {
    month,
    sums: rows.map(
      (r) => `${num(Number(kfp[r]!.cum) / 1000)} от ${num(Number(kfp[r]!.plan) / 1000)}`,
    ),
    cur: cur.map((v) => num(v, 1) + '%'),
    prev: prev.map((v) => num(v, 1) + '%'),
    bars: bars.map((v) => num(v, 1) + '%'),
    widths: bars.map(
      (v) => (v < 0 || Object.is(v, -0) ? '-' : '') + fixed(v, 1).replace(/\.0$/, '') + '%',
    ),
  };
}
export function cum(year: number, scope: string, row: string, month: number) {
  return Number(execution.data[String(year)]![scope]![row]![month - 1]!);
}
export function val(year: number, scope: string, row: string, month: number, mode: string) {
  return (
    cum(year, scope, row, month) -
    (mode === 'kum' || month === 1 ? 0 : cum(year, scope, row, month - 1))
  );
}
export function compare() {
  const { month, asOf } = execution.latest;
  const y = Number(asOf.slice(0, 4));
  const rows = ['rev', 'exp.total', 'balance'];
  const a = rows.map((r) => cum(y - 1, 'kfp', r, month));
  const b = rows.map((r) => cum(y, 'kfp', r, month));
  return {
    prev: a.map((v) => num(v / 1000)),
    cur: b.map((v) => num(v / 1000)),
    diff: [0, 1].map((i) => num((b[i]! - a[i]!) / 1000, 2, true)),
    balanceDiff: num(Math.abs(b[2]! - a[2]!) / 1000),
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
export const maxima = Object.fromEntries(
  employment.maxInsurableIncomeEur.map((m) => [m.id, m.eur]),
);
// Exact decimal integer arithmetic and ROUND_HALF_UP, independent of the browser's Number engine.
const scale = 1_000_000n;
function decimal(value: string | number) {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole!) * scale + BigInt(fraction.padEnd(6, '0'));
}
const rounded = (n: bigint, d: bigint) => (n + d / 2n) / d;
export function salaryModel(gross: string, rule: string, tzpb?: number) {
  const g = decimal(gross);
  const tz = decimal(
    tzpb === undefined
      ? employment.tzpbPct.used
      : Math.min(Math.max(tzpb, employment.tzpbPct.min), employment.tzpbPct.max),
  );
  function month(r: string) {
    const cap = decimal(maxima[r]!);
    const ins = g < cap ? g : cap;
    const emp = rounded(ins * decimal(employment.employeePct), scale * scale);
    const tax = rounded((g - emp * 10_000n) * decimal(employment.incomeTaxPct), scale * scale);
    const er = rounded(ins * (decimal(employment.employerPctWithoutTzpb) + tz), scale * scale);
    return { emp, tax, er };
  }
  const a = month(rule === 'year' ? 'until' : rule);
  const b = month(rule === 'year' ? 'from' : rule);
  const annual = (k: 'emp' | 'tax' | 'er') =>
    rule === 'year' ? a[k] * 7n + b[k] * 5n : a[k] * 12n;
  const yEmp = annual('emp'),
    yTax = annual('tax'),
    yEr = annual('er');
  const emp = rounded(yEmp, 12n),
    tax = rounded(yTax, 12n),
    er = rounded(yEr, 12n);
  return {
    emp: Number(emp) / 100,
    tax: Number(tax) / 100,
    er: Number(er) / 100,
    net: Number(rounded(g, 10_000n) - emp - tax) / 100,
    yEmp: Number(yEmp) / 100,
    yTax: Number(yTax) / 100,
    yEr: Number(yEr) / 100,
  };
}
