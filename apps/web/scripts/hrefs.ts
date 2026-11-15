/** The hrefs.py lexical rule, including its deliberately limited comment removal. */
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { match } from '../client/routes.js';
import { redirectHash } from '../client/redirects.js';
export function addresses(text: string, javascript = false): string[] {
  if (javascript) text = text.replace(/^\s*\/\/.*$/gm, '');
  // Python's Unicode \w is letters, numbers and underscore; JS \w is ASCII only.
  const href = /(?<![\p{L}\p{N}_&])#\/[A-Za-z0-9_\-/.:%+]*(?:\?[A-Za-z0-9_=&,.%:+\-]*)?/gu;
  return [...text.matchAll(href)]
    .map((m) => m[0].replace(/\.+$/, ''))
    .filter((h) => h !== '#/' && h !== '#/:' && h.length >= 3);
}
export function collect(root = fileURLToPath(new URL('../../../', import.meta.url))) {
  const found = new Map<string, Set<string>>();
  // Scan the actual source and release directories: Path.rglob on the old
  // composed symlink root never descended into data/ or js/ (an empty pass).
  for (const directory of ['data/release', 'apps/web/client', 'apps/web/public']) {
    function walk(path: string) {
      for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        if (entry.name === 'vendor') continue;
        const file = join(path, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (['.js', '.json'].includes(extname(file)))
          for (const h of addresses(readFileSync(file, 'utf8'), extname(file) === '.js')) {
            if (!found.has(h)) found.set(h, new Set());
            found.get(h)!.add(relative(root, file));
          }
      }
    }
    walk(join(root, directory));
  }
  return found;
}
export function destination(h: string) {
  const to = redirectHash(h);
  const path = (to || h).replace(/^#/, '').split('?')[0];
  let id: string | null = null;
  try {
    id = match(path.split('/').filter(Boolean).map(decodeURIComponent))?.route.id ?? null;
  } catch {
    /* malformed escapes are dead */
  }
  if (!path.split('/').filter(Boolean).length) id = 'S01';
  return { h, to, id };
}

// Kept as an explicit manual check while current-main comment examples are dead.
// No address is allowlisted: this has the same lexical rule as the Python tool.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = collect();
  let dead = 0;
  for (const [h, files] of found) {
    const { to, id } = destination(h);
    const kind = !id ? 'DEAD' : to ? 'REDIRECT' : 'OK';
    if (!id) dead++;
    if (kind !== 'OK' || process.argv.includes('--all'))
      console.log(kind, h, to, id, [...files].slice(0, 4));
  }
  console.log(`${found.size} distinct addresses; DEAD ${dead}`);
  process.exitCode = dead || !found.size ? 1 : 0;
}
