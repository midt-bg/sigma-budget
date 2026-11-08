import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadAnnex, checkAnnexSums, type AnnexTables } from '../build/annex.js';
import { BuildContext, executionNumbers } from '../build/context.js';
import { parseYaml, registries, registryInputs } from '../io/registry.js';
import {
  clean,
  jsonStringify,
  writeJson,
  sha256File,
  readPinned,
  jsonstatCells,
  jsonstatSeries,
} from '../io/data.js';
import {
  formatNumber,
  formatPercent,
  formatMoney,
  formatThousands,
  formatEuro,
  formatDate,
  monthName,
} from './format.js';
import { sources, pendingDefinitions, pendingForExecution, pendingBlock } from './sources.js';
import { metadata, span } from './metadata.js';
import { compare, type Difference } from '../parity/compare.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const fixtures = join(root, 'packages/ingest/test/fixtures/common');
const load = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const fixture = (p: string) => load(join(fixtures, p));
const diffs: Difference[] = [];
const checked = new Set<string>();
const expectedComparisons = [
  'annex.json',
  'registries.json',
  'source-map.json',
  'metadata.json',
  'execution-numbers.json',
  'source-definitions.json',
  'format.json',
  'context-annex.json',
  'context-execution.json',
  'jsonstat.json',
];
function parity(name: string, expected: unknown, actual: unknown) {
  const result = compare(expected, actual, { dataset: 'common', file: name });
  checked.add(name);
  diffs.push(...result);
  expect(result).toEqual([]);
}

describe('common Python parity', () => {
  it('uses the pinned annex evidence and reproduces tree, values and checks', () => {
    const provenance = fixture('provenance.json');
    expect(
      createHash('sha256')
        .update(readFileSync(join(fixtures, 'asbp-tables.json')))
        .digest('hex'),
    ).toBe(provenance.fixtureSha256);
    const annex = loadAnnex(fixture('asbp-tables.json').tables);
    parity('annex.json', fixture('annex.json'), { annex, problems: checkAnnexSums(annex) });
    const changed = structuredClone(annex);
    changed.mln['r.total']![0]! += 10;
    expect(checkAnnexSums(changed)).toContainEqual(expect.stringContaining('r.total 2024'));
    const invalid: AnnexTables = structuredClone(fixture('asbp-tables.json').tables);
    invalid.annex3_mln.rows[0]!.label = 'changed';
    expect(() => loadAnnex(invalid)).toThrow('label mismatch');
    invalid.annex3_mln.rows[0]!.label = fixture('asbp-tables.json').tables.annex3_mln.rows[0].label;
    invalid.annex3_pct_gdp.rows = invalid.annex3_pct_gdp.rows.filter(
      (row) => row.label.replaceAll(' ', '') !== 'БВП',
    );
    expect(() => loadAnnex(invalid)).toThrow('layout changed');
  });
  it('reads both real registries with Python scalar semantics', () => {
    const parsed = ['sources', 'datasets'].map((n) =>
      parseYaml(readFileSync(join(root, `data/${n}.yaml`), 'utf8')),
    );
    parity('registries.json', fixture('registries.json'), parsed);
    const [s, d] = registries(parsed[0]!, parsed[1]!);
    expect(s.sources.length).toBeGreaterThan(0);
    expect(d.datasets.length).toBeGreaterThan(0);
  });
  it('maps files, shared inputs, skipped and missing sources like Python', () => {
    const base = join(fixtures, 'source-map');
    const [s, d] = registries(
      parseYaml(readFileSync(join(base, 'data-sources.yaml'), 'utf8')),
      parseYaml(readFileSync(join(base, 'data-datasets.yaml'), 'utf8')),
    );
    parity('source-map.json', fixture('source-map.json'), registryInputs(s, d, base));
  });
  it('reproduces metadata and the execution/2 numeric adapter', () => {
    parity('metadata.json', fixture('metadata.json'), [
      metadata('id', 'Заглавие', '2026-11-08'),
      metadata('x', 'title', '2026-11-08', {
        status: 'mock',
        source: ['asbp'],
        sourceNote: 'note',
        asOf: '2026-01-02',
        unit: '€',
        extra: { custom: 3 },
      }),
    ]);
    const input = load(join(root, 'data/release/execution.json'));
    parity('execution-numbers.json', fixture('execution-numbers.json'), executionNumbers(input));
    expect((Object.values(input.data['2026'].kfp)[0] as unknown[])[0]).toEqual(expect.any(String));
    const old = { contract: { schema: 1 } };
    expect(executionNumbers(old)).toBe(old);
  });
  it('preserves source and pending maps against Python', () => {
    const pending = structuredClone(pendingDefinitions);
    pendingForExecution(pending, load(join(root, 'data/release/execution.json')));
    parity('source-definitions.json', fixture('source-definitions.json'), {
      sources,
      pending,
      block: pendingBlock(pending, 'P04', { note: 'test' }),
    });
    expect(() => pendingBlock(pending, 'missing')).toThrow();
  });
  it('formats shared display values against Python', () => {
    parity('format.json', fixture('format.json'), {
      number: [1234.56, -0.001, -42.5, null].map((v) => formatNumber(v, 2, true)),
      ties: [2.5, 3.5, -2.5].map((v) => formatNumber(v)),
      percent: formatPercent(12.3),
      money: [1234.5, 100, 12.3, null].map((v) => formatMoney(v)),
      thousands: formatThousands(4567),
      euro: formatEuro(4567),
      dates: [formatDate('2026-11-08'), formatDate('2026-11-08', true), formatDate(null)],
      month: monthName(8),
    });
  });
  it('reads isolated roots lazily and memoizes inputs and build outputs', () => {
    const temp = mkdtempSync(join(tmpdir(), 'budget-common-'));
    try {
      for (const dir of ['inputs', 'originals/asbp', 'cache', 'release'])
        mkdirSync(join(temp, dir), { recursive: true });
      writeFileSync(
        join(temp, 'originals/asbp/asbp_tables.json'),
        readFileSync(join(fixtures, 'asbp-tables.json')),
      );
      writeFileSync(join(temp, 'inputs/example.json'), '{"value":1}');
      writeFileSync(
        join(temp, 'release/execution.json'),
        readFileSync(join(root, 'data/release/execution.json')),
      );
      const ctx = new BuildContext({
        inputs: join(temp, 'inputs'),
        originals: join(temp, 'originals'),
        cache: join(temp, 'cache'),
        release: join(temp, 'release'),
      });
      const first = ctx.src('example');
      writeFileSync(join(temp, 'inputs/example.json'), '{"value":2}');
      expect(ctx.src('example')).toBe(first);
      parity('context-annex.json', fixture('annex.json').annex, ctx.annex);
      parity('context-execution.json', fixture('execution-numbers.json'), ctx.execution);
      expect(ctx.gdp.mlnPrecise).toEqual(ctx.annex.gdp);
      expect(ctx.cacheExists('absent')).toBe(false);
      expect(() => ctx.cache('absent')).toThrow();
      expect(ctx.put('x.json', { a: 1 })).toEqual({ a: 1 });
      expect(ctx.get('x.json')).toEqual({ a: 1 });
      expect(ctx.get('missing')).toBeNull();
      expect(ctx.putText('feed.xml', 'text')).toBe('text');
      expect(ctx.texts['feed.xml']).toBe('text');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
  it('rejects duplicate keys, ambiguous scalars, invalid registries and malformed series', () => {
    for (const input of [
      'x: 1\nx: 2',
      'x: .nan',
      'x: .inf',
      'x: 99999999999999999999999',
      '1: value',
      'x: 2026-11-08',
      'x: &a [1]\ny: *a',
      'x: !unknown scalar',
    ])
      expect(() => parseYaml(input)).toThrow();
    expect(() =>
      registries(
        parseYaml('schema: 1\nsources: [{id: x, acquisition: auto}, {id: x, acquisition: auto}]'),
        parseYaml('schema: 1\ndatasets: []'),
      ),
    ).toThrow();
    expect(span([null, 1, 2, null])).toEqual([1, [1, 2]]);
    expect(span([null, null])).toEqual([0, []]);
    expect(() => span([1, null, 2])).toThrow();
  });
  it('handles strict JSON, deterministic writes and JSON-stat dimensions', async () => {
    expect(clean({ x: -0 })).toEqual({ x: 0 });
    expect(() => jsonStringify({ a: [Infinity] })).toThrow('$.a[0]');
    const temp = mkdtempSync(join(tmpdir(), 'budget-io-'));
    try {
      const path = join(temp, 'nested/test.json');
      expect(await writeJson(path, { text: 'Бюджет' })).toEqual({
        bytes: Buffer.byteLength('{"text":"Бюджет"}\n'),
        changed: true,
      });
      const mtime = statSync(path).mtimeMs;
      expect((await writeJson(path, { text: 'Бюджет' })).changed).toBe(false);
      expect(statSync(path).mtimeMs).toBe(mtime);
      expect(await readPinned(path, await sha256File(path))).toEqual(readFileSync(path));
      await expect(readPinned(path, '0'.repeat(64))).rejects.toThrow('hash mismatch');
      expect(await sha256File(path)).toBe(
        createHash('sha256').update(readFileSync(path)).digest('hex'),
      );
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
    const js = {
      id: ['geo', 'time'],
      size: [2, 2],
      dimension: {
        geo: { category: { index: { BG: 0, EU: 1 } } },
        time: { category: { index: ['2024', '2025'] } },
      },
      value: [1, null, 3, 4],
      status: { '2': 'p' },
    };
    parity('jsonstat.json', fixture('jsonstat.json'), {
      cells: jsonstatCells(js),
      series: jsonstatSeries(js, 'time', { geo: 'EU' }),
    });
  });
  afterAll(() => {
    const report = process.env.COMMON_PARITY_REPORT;
    if (!report) return;
    const unverified = expectedComparisons.filter((name) => !checked.has(name));
    mkdirSync(dirname(report), { recursive: true });
    writeFileSync(
      report,
      JSON.stringify(
        {
          outcome: diffs.length ? 'fail' : unverified.length ? 'unverified' : 'pass',
          differences: diffs,
          unverified,
        },
        null,
        2,
      ) + '\n',
    );
  });
});
