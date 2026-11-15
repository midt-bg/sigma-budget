import { readFile } from 'node:fs/promises';
import type { Download } from '@playwright/test';
/** A bounded event wait, with a useful failure instead of an unresolved route gate. */
export async function within<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function downloadBytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  if (!path) throw new Error('Download did not produce a local file');
  return readFile(path);
}

/** Python Page.evaluate invokes function strings; JS Page.evaluate treats strings as expressions.
 * Keep the original probes intact and reproduce Python's expression-or-function semantics.
 */
export async function evaluateProbe<T = unknown, A = undefined>(
  page: import('@playwright/test').Page,
  source: string,
  arg?: A,
): Promise<T> {
  const argument = JSON.stringify(arg) ?? 'undefined';
  return page.evaluate(
    `((value) => typeof value === 'function' ? value(${argument}) : value)((${source}\n))`,
  );
}
