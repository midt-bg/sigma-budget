import { readFileSync } from 'node:fs';

type PythonFixtureHistory = {
  lastPresentCommit: string;
  files: Record<string, { sha256: string; lastChangedCommit: string }>;
};
let history: PythonFixtureHistory | undefined;
export function readPythonFixtureHistory(): PythonFixtureHistory {
  return (history ??= JSON.parse(
    readFileSync(new URL('../../test/python-fixture-history.json', import.meta.url), 'utf8'),
  ) as PythonFixtureHistory);
}

/** A removed source pin is a historical fact, never a substitute for a DATA checksum. */
export function verifyHistoricalPythonPin(path: string, sha256: unknown): void {
  const pythonFixtureHistory = readPythonFixtureHistory();
  const record = Object.hasOwn(pythonFixtureHistory.files, path)
    ? pythonFixtureHistory.files[path]
    : undefined;
  if (
    !path.endsWith('.py') ||
    !record ||
    typeof sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    record.sha256 !== sha256 ||
    !/^[a-f0-9]{40}$/.test(record.lastChangedCommit) ||
    !/^[a-f0-9]{40}$/.test(pythonFixtureHistory.lastPresentCommit)
  )
    throw new Error(`Invalid historical Python fixture pin: ${path}`);
}
