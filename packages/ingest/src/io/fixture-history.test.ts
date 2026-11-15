import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { expect, it } from 'vitest';
import { readPythonFixtureHistory, verifyHistoricalPythonPin } from './fixture-history.js';
const pythonFixtureHistory = readPythonFixtureHistory();
const historySha256 = 'd1acb5a6c69a7e02be6c707b4b781f16f9ce90436b0e0fd8112dd413fdcc7dbc';
const fixtures = new URL('../../test/fixtures/', import.meta.url);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

it('authenticates every historical record against the frozen history file checksum', () => {
  expect(
    sha(readFileSync(new URL('../../test/python-fixture-history.json', import.meta.url))),
  ).toBe(historySha256);
});

it('keeps a complete historical source receipt and no Python files in the fixture tree', () => {
  expect(pythonFixtureHistory.lastPresentCommit).toBe('7cc016407f87a2bfc4aa9d75e942edc5552cf3d3');
  expect(Object.keys(pythonFixtureHistory.files)).toHaveLength(314);
  for (const [path, record] of Object.entries(pythonFixtureHistory.files))
    verifyHistoricalPythonPin(path, record.sha256);
  expect(
    readdirSync(new URL('../../test/fixtures/', import.meta.url), {
      recursive: true,
      encoding: 'utf8',
    }).filter((path) => path.endsWith('.py')),
  ).toEqual([]);
});

it('rejects unknown paths, changed historical hashes and DATA paths', () => {
  const path = 'aggregation-rss/donor/feed.py';
  expect(() => verifyHistoricalPythonPin(path, '0'.repeat(64))).toThrow(/historical/);
  expect(() => verifyHistoricalPythonPin('missing.py', '0'.repeat(64))).toThrow(/historical/);
  expect(() => verifyHistoricalPythonPin('catalog/inputs/authored.json', '0'.repeat(64))).toThrow(
    /historical/,
  );
  const record = pythonFixtureHistory.files[path]!;
  const commit = record.lastChangedCommit;
  try {
    record.lastChangedCommit = 'invalid';
    expect(() => verifyHistoricalPythonPin(path, record.sha256)).toThrow(/historical/);
  } finally {
    record.lastChangedCommit = commit;
  }
});

it('retains every Python pin in the exact historical catalog inventory', () => {
  const inventory = JSON.parse(
    readFileSync(new URL('../../test/fixtures/catalog/provenance.json', import.meta.url), 'utf8'),
  ) as { files: Record<string, string> };
  const pins = Object.entries(inventory.files).filter(([name]) => name.endsWith('.py'));
  expect(pins).toHaveLength(12);
  for (const [name, hash] of pins) verifyHistoricalPythonPin(`catalog/${name}`, hash);
});

it('checks Python path/hash pairs in every JSON manifest against the history', () => {
  const families = new Set(readdirSync(fixtures));
  let checked = 0;
  const check = (manifest: string, path: string, hash: unknown) => {
    expect(hash, `${manifest}: ${path}`).toMatch(/^[a-f0-9]{64}$/);
    const candidates = new Set<string>();
    const prefix = 'packages/ingest/test/fixtures/';
    if (path.startsWith(prefix)) candidates.add(path.slice(prefix.length));
    else if (families.has(path.split('/')[0]!)) candidates.add(normalize(path));
    else {
      // Supplemental manifests also refer to their family's original generator;
      // corpus inventories name original repository paths beneath corpus/.
      for (let base = dirname(manifest); base !== '.'; base = dirname(base))
        for (const folder of ['', 'donor', 'corpus'])
          candidates.add(normalize(join(base, folder, path)));
    }
    const known = [...candidates].filter((candidate) =>
      Object.hasOwn(pythonFixtureHistory.files, candidate),
    );
    // These are repository-wide capture DATA, not removed fixture-source pins.
    // Fixture paths inside those captures still go through the checks above.
    if (
      !known.length &&
      /^(apps|pipeline|tests|reference|packages)\//.test(path) &&
      !path.startsWith(prefix)
    )
      return;
    const matching = known.filter(
      (candidate) => pythonFixtureHistory.files[candidate]!.sha256 === hash,
    );
    expect(matching.length, `${manifest}: ${path}`).toBeGreaterThan(0);
    for (const candidate of matching) verifyHistoricalPythonPin(candidate, hash);
    checked++;
  };
  const walk = (value: unknown, manifest: string, field = '') => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      if (
        value.length === 2 &&
        typeof value[0] === 'string' &&
        value[0].endsWith('.py') &&
        typeof value[1] === 'string'
      )
        check(manifest, value[0], value[1]);
      for (const child of value) walk(child, manifest, field);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const [path, child] of Object.entries(record)) {
      if (path.endsWith('.py') && field !== 'sourceRoles') {
        const hash =
          child && typeof child === 'object' ? (child as Record<string, unknown>).sha256 : child;
        check(manifest, path, hash);
      }
      walk(child, manifest, path);
    }
    for (const field of ['path', 'file', 'module']) {
      const path = record[field];
      if (typeof path === 'string' && path.endsWith('.py') && 'sha256' in record)
        check(manifest, path, record.sha256);
    }
  };
  for (const file of readdirSync(fixtures, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.json')) continue;
    const text = readFileSync(new URL(file, fixtures), 'utf8');
    if (text.includes('.py')) walk(JSON.parse(text), file);
  }
  expect(checked).toBeGreaterThan(0);
});

it('rejects a present file at a caller-supplied fixture path despite a valid historical pin', () => {
  const root = mkdtempSync(join(tmpdir(), 'sigma-present-python-'));
  const path = 'wave13b/donor/budget_pipeline/__init__.py';
  try {
    const file = join(root, '__init__.py');
    writeFileSync(file, '');
    expect(sha(readFileSync(file))).toBe(pythonFixtureHistory.files[path]!.sha256);
    expect(() =>
      verifyHistoricalPythonPin(path, pythonFixtureHistory.files[path]!.sha256, file),
    ).toThrow(/Historical Python fixture is present/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it('authenticates the retained validate15b PDF audit and supplemental provenance', () => {
  const base = new URL('validate15b/', fixtures);
  const bytes = (name: string) => readFileSync(new URL(name, base));
  const pins = {
    'pdf-audit.json': '3af8035c5f8f30d9121442471a7de7b40c152518aa6b4f072c4254a64ae2bced',
    'source-order-provenance.json':
      '318350553d114ef5d8045e623dfcf14ad15f16694470b109de9f3f7f82475f96',
    'source-methods-provenance.json':
      '20a4173be2d68fddb95d955a025ed5a95815df82b70ce8219281ce37882707af',
    'optional-values-provenance.json':
      'e9c2bc09a1bc643319785160caf792949b5d94527d2992991de9076ece0bc0f5',
  };
  for (const [file, hash] of Object.entries(pins)) expect(sha(bytes(file)), file).toBe(hash);
  for (const [name, script] of [
    ['source-order', 'source_order.py'],
    ['source-methods', 'source_methods.py'],
    ['optional-values', 'optional_values.py'],
  ]) {
    const proof = JSON.parse(bytes(`${name}-provenance.json`).toString());
    verifyHistoricalPythonPin(`validate15b/${script}`, proof.generatorSha256);
    expect(sha(bytes(`${name}.json`))).toBe(proof.oracleSha256);
    if (proof.inventorySha256) expect(sha(bytes('inventory.json'))).toBe(proof.inventorySha256);
    if (proof.sourceOrderSha256)
      verifyHistoricalPythonPin('validate15b/source_order.py', proof.sourceOrderSha256);
    for (const [path, hash] of Object.entries(proof.inputs ?? {})) {
      if (path.endsWith('.py')) verifyHistoricalPythonPin(`validate15b/${path}`, hash);
      else expect(sha(bytes(path)), path).toBe(hash);
    }
  }
});
