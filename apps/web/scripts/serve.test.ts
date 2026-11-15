import { mkdtempSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, test } from 'vitest';
import { startStaticServer, staticRoot } from './serve.ts';
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function directory() {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-static-'));
  dirs.push(dir);
  return dir;
}
test('composition links public assets, built JS and immutable release data without copying', () => {
  const root = directory();
  for (const dir of ['apps/web/public', 'apps/web/build/client/js', 'data/release'])
    mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'apps/web/public/index.html'), 'shell');
  const target = staticRoot(root);
  expect(readlinkSync(join(target, 'data'))).toBe(join(root, 'data/release'));
  expect(readlinkSync(join(target, 'js'))).toBe(join(root, 'apps/web/build/client/js'));
  expect(readlinkSync(join(target, 'index.html'))).toBe(join(root, 'apps/web/public/index.html'));
  expect(staticRoot(root)).toBe(target);
  rmSync(join(target, 'js'));
  symlinkSync(join(root, 'apps/web/public'), join(target, 'js'));
  staticRoot(root);
  expect(readlinkSync(join(target, 'js'))).toBe(join(root, 'apps/web/build/client/js'));
});
test('Python path rules, GET/HEAD, MIME, query, cache, missing files and composed symlinks', async () => {
  const dir = directory(),
    outside = directory();
  const put = (name: string, body: string) => writeFileSync(join(dir, name), body);
  put('index.html', 'shell');
  put('screen.html', 'screen');
  put('other.html', 'other');
  mkdirSync(join(dir, 'nested'));
  put('nested/index.html', 'nested');
  for (const ext of ['js', 'css', 'json', 'csv', 'xml', 'svg', 'woff2', 'unknown'])
    put('asset.' + ext, ext);
  mkdirSync(join(dir, 'listing.json'));
  put('listing.json/item.txt', 'entry');
  put('asset.json.gz', 'compressed fixture');
  put('asset.map', 'map');
  put('име.html', 'unicode');
  put('encoded.js', 'encoded');
  writeFileSync(join(outside, 'core.json'), '{}');
  symlinkSync(outside, join(dir, 'data'));
  const site = await startStaticServer(dir);
  try {
    for (const [path, body, type] of [
      ['/', 'shell', 'text/html; charset=utf-8'],
      ['/index.html', 'shell', 'text/html'],
      ['/screen?x=1', 'screen', 'text/html; charset=utf-8'],
      ['/screen/', 'screen', 'text/html; charset=utf-8'],
      ['/nested', 'nested', 'text/html; charset=utf-8'],
      ['/nested/', 'nested', 'text/html; charset=utf-8'],
      ['/missing', 'shell', 'text/html; charset=utf-8'],
      ['/vedomstvo/0200/0200.01.00', 'shell', 'text/html; charset=utf-8'],
      ['/embed/prognoza.s13-deficit', 'shell', 'text/html; charset=utf-8'],
      ['/embed/test.json', 'shell', 'text/html; charset=utf-8'],
      ['/missing.abcdef', 'shell', 'text/html; charset=utf-8'],
      ['/missing.123', 'shell', 'text/html; charset=utf-8'],
      ['/%D0%B8%D0%BC%D0%B5', 'unicode', 'text/html; charset=utf-8'],
      ['/encoded%2Ejs', 'encoded', 'text/javascript'],
      ['/data/core.json', '{}', 'application/json'],
      ['/asset.json.gz', 'compressed fixture', 'application/json'],
      ['/asset.map', 'map', 'application/octet-stream'],
      ...Object.entries({
        js: 'text/javascript',
        css: 'text/css',
        json: 'application/json',
        csv: 'text/csv',
        xml: 'text/xml',
        svg: 'image/svg+xml',
        woff2: 'font/woff2',
        unknown: 'application/octet-stream',
      }).map(([ext, type]) => ['/asset.' + ext, ext, type]),
    ]) {
      const response = await fetch(site.url + path);
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toBe(body);
      expect(response.headers.get('content-type'), path).toBe(type);
      expect(response.headers.get('cache-control'), path).toBe('no-cache');
      expect(response.headers.get('content-length'), path).toBe(String(Buffer.byteLength(body)));
      const head = await fetch(site.url + path, { method: 'HEAD' });
      expect(head.status, path).toBe(200);
      expect(await head.text()).toBe('');
      expect(head.headers.get('content-type'), path).toBe(type);
      expect(head.headers.get('content-length'), path).toBe(String(Buffer.byteLength(body)));
    }
    for (const path of ['/missing.json', '/data/missing.json', '/missing.js?query=1']) {
      const response = await fetch(site.url + path);
      expect(response.status, path).toBe(404);
      expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8');
      expect(await response.text()).toContain('Error code: 404');
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect((await fetch(site.url + path, { method: 'HEAD' })).status).toBe(404);
    }
    const listingRedirect = await fetch(site.url + '/listing.json?x=1', { redirect: 'manual' });
    expect(listingRedirect.status).toBe(301);
    expect(listingRedirect.headers.get('location')).toBe('/listing.json/?x=1');
    // A trailing slash no longer matches FILE_EXT, so it receives the app shell.
    expect(await (await fetch(site.url + '/listing.json/')).text()).toBe('shell');
    const response = await fetch(site.url + '/asset.js');
    expect(
      (
        await fetch(site.url + '/asset.js', {
          headers: { 'If-Modified-Since': response.headers.get('last-modified')! },
        })
      ).status,
    ).toBe(304);
    // SimpleHTTPRequestHandler ignores Range and returns the complete file.
    expect(
      await (await fetch(site.url + '/asset.js', { headers: { Range: 'bytes=0-0' } })).text(),
    ).toBe('js');
    expect((await fetch(site.url + '/', { method: 'POST' })).status).toBe(501);
  } finally {
    await site.close();
  }
});
