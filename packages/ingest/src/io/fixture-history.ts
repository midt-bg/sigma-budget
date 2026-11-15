import { lstatSync, readFileSync } from 'node:fs';

// Only fixture-scope commands (budget-ts build --scope <fixture scope>, wave13b-live)
// read this test history. ./budget build/validate, release and the Worker do not use it.

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
export function verifyHistoricalPythonPin(
  path: string,
  sha256: unknown,
  file: string | URL = new URL(`../../test/fixtures/${path}`, import.meta.url),
): void {
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
  try {
    lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Historical Python fixture is present: ${path}`);
}
