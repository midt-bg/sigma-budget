/** Browser-only composition and path fallback, matching serve.py. No release data is copied. */
import { createServer } from 'node:http';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  statSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { basename, extname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
/** urllib.parse.unquote, including replacement decoding of malformed UTF-8. */
function unquote(value: string) {
  return value.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) =>
    new TextDecoder().decode(Uint8Array.from(run.slice(1).split('%'), (h) => parseInt(h, 16))),
  );
}

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export function staticRoot(root = ROOT): string {
  const target = join(root, 'tmp/static-site');
  mkdirSync(target, { recursive: true });
  const entries = new Map(
    readdirSync(join(root, 'apps/web/public')).map((name) => [
      name,
      join(root, 'apps/web/public', name),
    ]),
  );
  entries.set('js', join(root, 'apps/web/build/client/js'));
  entries.set('data', join(root, 'data/release'));
  for (const [name, source] of entries) {
    const dest = join(target, name);
    if (
      lstatSync(dest, { throwIfNoEntry: false })?.isSymbolicLink() &&
      resolve(target, readlinkSync(dest)) !== resolve(source)
    )
      unlinkSync(dest);
    if (!existsSync(dest) && !lstatSync(dest, { throwIfNoEntry: false })) symlinkSync(source, dest);
  }
  return target;
}
const FILE_EXT = /\.[A-Za-z][A-Za-z0-9]{0,4}$/;
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.svg': 'image/svg+xml',
  '.xml': 'text/xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/vnd.microsoft.icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.tar': 'application/x-tar',
};
function isFile(path: string) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}
function contained(base: string, path: string) {
  // Python Path.resolve also resolves symlinks; a composed data/js symlink is deliberately outside base.
  let target = path;
  const tail: string[] = [];
  while (!existsSync(target)) {
    tail.unshift(basename(target));
    const parent = resolve(target, '..');
    if (parent === target) break;
    target = parent;
  }
  const rel = relative(realpathSync(base), resolve(realpathSync(target), ...tail));
  return rel !== '..' && !rel.startsWith('../');
}
export async function startStaticServer(
  directory: string,
  port = 0,
  shell = readFileSync(join(directory, 'index.html')),
) {
  const base = resolve(directory);
  const server = createServer((req, res) => {
    const send = (body: Buffer | string, status = 200, type = 'text/html; charset=utf-8') => {
      res.writeHead(status, {
        'Content-Type': type,
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const error = (status: number, message: string, explanation: string) =>
      send(
        `<!DOCTYPE HTML>\n<html lang="en">\n    <head>\n        <meta charset="utf-8">\n        <title>Error response</title>\n    </head>\n    <body>\n        <h1>Error response</h1>\n        <p>Error code: ${status}</p>\n        <p>Message: ${message}.</p>\n        <p>Error code explanation: ${status} - ${explanation}.</p>\n    </body>\n</html>\n`,
        status,
        'text/html;charset=utf-8',
      );
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      error(501, `Unsupported method ('${req.method}')`, 'Server does not support this operation');
      return;
    }
    const raw = (req.url ?? '/').split(/[?#]/)[0]!;
    const decoded = unquote(raw);
    const rel = posix.normalize(decoded).replace(/^\/+|\/+$/g, '') || 'index.html';
    let file: string | undefined;
    for (const candidate of [
      join(base, rel),
      join(base, rel + '.html'),
      join(base, rel, 'index.html'),
    ]) {
      if (!contained(base, candidate)) break;
      if (isFile(candidate)) {
        file = candidate;
        break;
      }
    }
    if (file && extname(file) === '.html' && basename(file) !== posix.basename(decoded)) {
      send(readFileSync(file));
      return;
    }
    if (!file && !(FILE_EXT.test(raw) && !raw.startsWith('/embed/'))) {
      send(shell);
      return;
    }
    // SimpleHTTPRequestHandler's ordinary-file path translation (symlinks allowed).
    const ordinary = join(
      base,
      ...posix
        .normalize(decoded)
        .split('/')
        .filter((p) => p && p !== '.' && p !== '..'),
    );
    if (statSync(ordinary, { throwIfNoEntry: false })?.isDirectory()) {
      // Only an extension-bearing path reaches this branch; after the ordinary
      // directory redirect its trailing slash receives the shell in _route().
      const suffix = (req.url ?? '').slice(raw.length);
      res.writeHead(301, {
        Location: raw + '/' + suffix,
        'Content-Length': '0',
        'Cache-Control': 'no-cache',
      });
      res.end();
      return;
    }
    if (!isFile(ordinary)) {
      error(404, 'File not found', 'Nothing matches the given URI');
      return;
    }
    const stat = statSync(ordinary);
    if (!req.headers['if-none-match'] && req.headers['if-modified-since']) {
      const since = Date.parse(req.headers['if-modified-since']);
      if (Number.isFinite(since) && Math.floor(stat.mtimeMs / 1000) <= Math.floor(since / 1000)) {
        res.writeHead(304, { 'Cache-Control': 'no-cache' });
        res.end();
        return;
      }
    }
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    send(
      readFileSync(ordinary),
      200,
      TYPES[extname(ordinary.replace(/\.(?:gz|bz2|xz|br|Z)$/, '')).toLowerCase()] ??
        'application/octet-stream',
    );
  });
  await new Promise<void>((done, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', done);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      ),
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: { dir: { type: 'string' }, port: { type: 'string', default: '8000' } },
  });
  const directory = values.dir ? resolve(ROOT, values.dir) : staticRoot();
  const site = await startStaticServer(directory, Number(values.port));
  console.log(`serving ${directory} on ${site.url}/ (Ctrl+C to stop)`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.once(signal, () => {
      void site.close();
    });
}
