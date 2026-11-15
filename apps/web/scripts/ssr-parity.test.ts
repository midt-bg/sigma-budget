import { expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { addressOf, compare, compareServers, ldTypes, main, parse, pathOf } from './ssr-parity.ts';
it('retains text and internal links after React self-closing void elements', () => {
  const a = parse(
    '<article><h1>Търсене</h1><input><p>След полето</p><a href="/prihodi">Приходи</a></article>',
  );
  const b = parse(
    '<article><h1>Търсене</h1><input/><p>След полето</p><a href="/prihodi">Приходи</a></article>',
  );
  expect(b.text).toBe(a.text);
  expect(b.links).toEqual(new Set(['/prihodi']));
  expect(compare(a, b)).toEqual([]);
});
it('compares every crawler field and ignores only the original hidden text categories', () => {
  const a = parse(
    `<title>A &amp; B</title><meta name="description" content="old"><meta name="robots" content="index"><meta property="og:title" content="OG"><meta property="og:description" content="desc"><meta name="twitter:title" content="T"><link rel="canonical" href="https://a.test/x"><script type="application/ld+json">{"@graph":[{"@type":"WebPage"}]}</script><article><h1>One</h1><p class="lede">Lead</p><input/><p>Visible</p><span class="sr-only">hidden</span><div aria-hidden="true">hidden</div><script>hidden</script><style>hidden</style><template>hidden</template><noscript>hidden</noscript><a href="/a#x">A</a><a href="//external">external</a></article>`,
  );
  expect(a.title).toBe('A & B');
  expect(a.text).toBe('One Lead Visible A external');
  expect(a.links).toEqual(new Set(['/a']));
  const b = parse(
    '<title>Other</title><link rel="canonical" href="https://b.test/y"><article><h1>Two</h1><p class="lede">Other lead</p><a href="/b">B</a></article>',
  );
  expect(compare(a, b).map(([f]) => f)).toEqual([
    'title',
    'h1',
    'lede',
    'description',
    'robots',
    'og:title',
    'og:description',
    'twitter:title',
    'canonical',
    'json-ld',
    'links',
    'text',
  ]);
  expect(pathOf('https://example.org/x?q=1')).toBe('/x?q=1');
  expect(ldTypes('bad')).toEqual(['<invalid>']);
  expect(ldTypes('{"@graph":[{"@type":"Z"},{"@type":"A"}]}')).toEqual(['A', 'Z']);
  expect(addressOf('/dist', '/dist/index.html')).toBe('/');
  expect(addressOf('/dist', '/dist/404.html')).toBe('/nyama-takava-stranitsa');
  expect(addressOf('/dist', '/dist/a/b.html')).toBe('/a/b');
});
it('manual CLI fails empty input, differences and unreachable servers; compares all runtime samples', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ssr-parity-'));
  const seen = new Set<string>();
  let different = false;
  const server = createServer((req, res) => {
    seen.add(req.url!);
    res.statusCode = req.url?.includes('nyama') ? 404 : 200;
    res.end(
      different && req.url?.startsWith('/changed/')
        ? '<article>different</article>'
        : '<article>same</article>',
    );
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('TCP');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    expect(await main(['--dist', dir, '--url', url])).toBe(2);
    writeFileSync(join(dir, 'index.html'), '<article>same</article>');
    expect(await main(['--dist', dir, '--url', url])).toBe(0);
    writeFileSync(join(dir, 'index.html'), '<article>changed</article>');
    expect(await main(['--dist', dir, '--url', url, '--show', '0'])).toBe(1);
    expect(await compareServers(url, url)).toBe(0);
    expect(seen.size).toBeGreaterThan(30);
    different = true;
    expect(await compareServers(url, url + '/changed')).toBe(1);
    expect(await main(['--dist', dir, '--url', url])).toBe(1);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(dir, { recursive: true, force: true });
  }
  expect(await main(['--baseline-url', url, '--url', url])).toBe(2);
});

it('keeps entity text contiguous and visits nested articles once, as HTMLParser did', () => {
  const page = parse(
    '<article><h1>A</h1><code>data/&lt;код&gt;.json</code><article><p>Inner</p></article></article>',
  );
  expect(page.text).toBe('A data/<код>.json Inner');
});

it('retains the last title, canonical, JSON-LD and heading, and first nonempty lede', () => {
  const page = parse(
    '<title>Old</title><title>New</title><link rel="canonical" href="/a"><link rel="canonical" href="/b"><article><h1>Old</h1><h1>New</h1><p class="lede"></p><p class="lede">First</p><p class="lede">Second</p></article>',
  );
  expect(page.title).toBe('New');
  expect(page.h1).toBe('New');
  expect(page.canonical).toBe('/b');
  expect(page.lede).toBe('First');
});
