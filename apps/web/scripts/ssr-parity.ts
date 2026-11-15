/** Compare crawler-visible documents or byte-identical responses from two Workers.
 * node apps/web/scripts/ssr-parity.ts --dist dist --url http://127.0.0.1:8791
 * node apps/web/scripts/ssr-parity.ts --baseline-url http://127.0.0.1:8790 --url http://127.0.0.1:8791 [--host example.org]
 * Exit 0: parity; 1: differences; 2: unreachable server or empty dist.
 */
import { parseHTML } from 'linkedom';
import { globSync, readFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROUTES } from '../app/lib/routes.ts';
const normalize = (s: string) => s.split(/\s+/u).filter(Boolean).join(' ');
export function parse(doc: string) {
  const { document } = parseHTML(doc);
  document.normalize(); // Entity callbacks are one HTMLParser data chunk, not separate words.
  const meta: Record<string, string> = {};
  for (const el of document.querySelectorAll('meta')) {
    const key = el.getAttribute('name') || el.getAttribute('property');
    if (key) meta[key] = el.getAttribute('content') || '';
  }
  const links = new Set<string>(),
    text: string[] = [];
  function walk(node: Node, hidden = false) {
    if (node.nodeType === 3) {
      if (!hidden && node.textContent?.trim()) text.push(node.textContent);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.localName === 'a') {
      const href = el.getAttribute('href') || '';
      if (href.startsWith('/') && !href.startsWith('//')) links.add(href.split('#')[0]);
    }
    hidden ||=
      ['script', 'style', 'template', 'noscript'].includes(el.localName) ||
      el.classList.contains('sr-only') ||
      el.getAttribute('aria-hidden') === 'true';
    for (const child of el.childNodes) walk(child, hidden);
  }
  for (const article of document.querySelectorAll('article'))
    if (!article.parentElement?.closest('article')) walk(article);
  const last = (selector: string) => [...document.querySelectorAll(selector)].at(-1);
  const content = (selector: string) => normalize(last(selector)?.textContent || '');
  return {
    title: content('title'),
    meta,
    canonical: last('link[rel="canonical"]')?.getAttribute('href') || '',
    ld: last('script[type="application/ld+json"]')?.textContent || '',
    h1: content('article h1'),
    lede:
      [...document.querySelectorAll('article p.lede')]
        .map((p) => normalize(p.textContent || ''))
        .find(Boolean) || '',
    text: normalize(text.join(' ')),
    links,
  };
}
export function ldTypes(s: string) {
  try {
    return (JSON.parse(s || '{}')['@graph'] || [])
      .map((n: Record<string, string>) => n['@type'] || '')
      .sort();
  } catch {
    return ['<invalid>'];
  }
}
export const pathOf = (url: string) => (url || '').replace(/^https?:\/\/[^/]+/, '');
export function addressOf(dist: string, file: string) {
  const rel = relative(dist, file).replaceAll('\\', '/');
  return rel === 'index.html'
    ? '/'
    : rel === '404.html'
      ? '/nyama-takava-stranitsa'
      : '/' + rel.slice(0, -5);
}
export function compare(a: ReturnType<typeof parse>, b: ReturnType<typeof parse>) {
  const out: [string, unknown, unknown][] = [];
  for (const field of ['title', 'h1', 'lede'] as const)
    if (a[field] !== b[field]) out.push([field, a[field], b[field]]);
  for (const key of ['description', 'robots', 'og:title', 'og:description', 'twitter:title'])
    if ((a.meta[key] || '') !== (b.meta[key] || ''))
      out.push([key, a.meta[key] || '', b.meta[key] || '']);
  if (pathOf(a.canonical) !== pathOf(b.canonical))
    out.push(['canonical', pathOf(a.canonical), pathOf(b.canonical)]);
  if (JSON.stringify(ldTypes(a.ld)) !== JSON.stringify(ldTypes(b.ld)))
    out.push(['json-ld', ldTypes(a.ld), ldTypes(b.ld)]);
  if (a.links.size !== b.links.size || [...a.links].some((link) => !b.links.has(link)))
    out.push([
      'links',
      [...a.links]
        .filter((l) => !b.links.has(l))
        .sort()
        .slice(0, 6),
      [...b.links]
        .filter((l) => !a.links.has(l))
        .sort()
        .slice(0, 6),
    ]);
  if (a.text !== b.text) {
    let i = 0;
    while (i < Math.min(a.text.length, b.text.length) && a.text[i] === b.text[i]) i++;
    out.push([
      'text',
      a.text.slice(Math.max(0, i - 60), i + 120),
      b.text.slice(Math.max(0, i - 60), i + 120),
    ]);
  }
  return out;
}
export async function compareServers(baseline: string, current: string, host?: string) {
  const routes = [...new Set(ROUTES.flatMap((r) => r.samples).map((s) => s.replace(/^#/, '')))];
  const bad: string[] = [];
  async function response(base: string, path: string) {
    const r = await fetch(base.replace(/\/+$/, '') + path, { headers: host ? { Host: host } : {} });
    return { status: r.status, body: Buffer.from(await r.arrayBuffer()) };
  }
  for (const path of routes) {
    const a = await response(baseline, path),
      b = await response(current, path);
    if (a.status !== b.status || !a.body.equals(b.body)) {
      bad.push(path);
      console.log('DIFFERENT ' + path);
    }
  }
  console.log(
    `${routes.length} sample routes · ${routes.length - bad.length} byte-identical · ${bad.length} different`,
  );
  return bad.length || !routes.length ? 1 : 0;
}
export async function main(args = process.argv.slice(2)) {
  const { values: a } = parseArgs({
    args,
    options: {
      'baseline-url': { type: 'string' },
      host: { type: 'string' },
      dist: { type: 'string', default: 'dist' },
      url: { type: 'string', default: 'http://127.0.0.1:8791' },
      limit: { type: 'string', default: '0' },
      show: { type: 'string', default: '8' },
    },
  });
  try {
    if (a['baseline-url']) return await compareServers(a['baseline-url'], a.url, a.host);
    let files = globSync('**/*.html', { cwd: a.dist })
      .filter((f) => basename(f) !== 'app.html')
      .sort()
      .map((f) => resolve(a.dist, f));
    if (Number(a.limit)) files = files.slice(0, Number(a.limit));
    if (!files.length) {
      console.error(`no prerendered screens in ${a.dist}: nothing was compared`);
      return 2;
    }
    let bad = 0;
    const counts: Record<string, number> = {};
    for (const file of files) {
      const address = addressOf(resolve(a.dist), file);
      const response = await fetch(a.url.replace(/\/+$/, '') + address);
      const diffs = compare(parse(readFileSync(file, 'utf8')), parse(await response.text()));
      if (!diffs.length) continue;
      bad++;
      for (const [field] of diffs) counts[field] = (counts[field] || 0) + 1;
      if (bad <= Number(a.show)) console.log(address, diffs);
    }
    console.log(
      `${files.length} screens · ${files.length - bad} the same · ${bad} differ · by field: ${JSON.stringify(counts)}`,
    );
    return bad ? 1 : 0;
  } catch (e) {
    console.error(`cannot compare ${a.url}: ${String(e)}`);
    return 2;
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  process.exitCode = await main();
