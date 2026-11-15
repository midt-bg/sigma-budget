import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { readPythonFixtureHistory, verifyHistoricalPythonPin } from './fixture-history.js';
const pythonFixtureHistory = readPythonFixtureHistory();

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
