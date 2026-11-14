// The icons of the site are those of СИГМА: the white magnifier-„С“ with the map of Bulgaria on a deep-red tile. favicon.ico,
// favicon-16/32.png and apple-touch-icon.png are byte copies of the files of СИГМА (apps/web/public of midt-bg/sigma); icon-192/512.png
// and og.png are drawn by apps/web/scripts/make_images.py. The old bar-chart mark is gone from every live file.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { renderToString } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';
import { Layout } from '../root';

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const pub = (name: string) => readFileSync(join(PUBLIC, name));
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const COPIED_FROM_SIGMA = {
  'favicon.ico': 'f24a89b693b7f62f656290cf07909356511b04b5a19b6adacd18f01b7b1fb12b',
  'favicon-16.png': '5c5e5d3b6664d652d61a04b74d67328abc47d4c8f648963844e46e671f74a8e5',
  'favicon-32.png': '67b02d5b7037b9c62c78b602edb6b45186db186fabb4846d7bb9ee05c373cbb2',
  'apple-touch-icon.png': '8a4ef887fb3cd6bbc345b5ceef9a07288c52465b07d3d8a2ea1d43353cf18f71',
};
// the head links of СИГМА (apps/web/app/root.tsx there), in its order
const ICON_LINKS = [
  { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
  { rel: 'icon', href: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
  { rel: 'icon', href: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
];
// split, so that this file does not match its own scan
const OLD_FAVICON = '/favicon' + '.svg';
const BAR_MARK = ['x="13' + '.3"', 'x="21' + '.6"', 'cx="24' + '.3"'];
const TILE = [0x7c, 0x04, 0x0d];

/** rel, href, sizes and type of every icon or manifest <link> of an HTML document */
function headLinks(html: string) {
  return [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) =>
      Object.fromEntries(
        [...tag.matchAll(/\s([a-zA-Z-]+)="([^"]*)"/g)]
          .filter(([, k]) => ['rel', 'href', 'sizes', 'type'].includes(k))
          .map(([, k, v]) => [k, v]),
      ),
    )
    .filter((a) => ['icon', 'apple-touch-icon', 'manifest'].includes(a.rel));
}

/** width, height and RGB pixels of an 8-bit, non-interlaced RGB or RGBA PNG (what Chromium's screenshots are) */
function decodePng(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG');
  let at = 8;
  const idat: Buffer[] = [];
  let width = 0,
    height = 0,
    channels = 0;
  while (at < bytes.length) {
    const len = bytes.readUInt32BE(at),
      type = bytes.toString('latin1', at + 4, at + 8),
      data = bytes.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect([data[8], data[12]]).toEqual([8, 0]); // bit depth 8, no interlace
      channels = { 2: 3, 6: 4 }[data[9]] ?? 0;
      expect(channels).toBeGreaterThan(0);
    } else if (type === 'IDAT') idat.push(data);
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    stride = width * channels,
    px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)],
      line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0,
        b = y > 0 ? px[(y - 1) * stride + x] : 0,
        c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predictor = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][
        filter
      ];
      px[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  const rgb = (x: number, y: number) => [...px.subarray((y * width + x) * channels).subarray(0, 3)];
  return { width, height, rgb };
}

/** the size of a PNG from its header, without decoding it */
const pngSize = (bytes: Buffer) => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];

/** the live files of the repository: everything but generated output and the frozen evidence that .prettierignore names */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'build',
  'dist',
  'coverage',
  'tmp',
  '.react-router',
  '.wrangler',
  '.turbo',
  '__fixtures__',
  'fixtures',
  'vendor',
]);
const SKIP_TOP = new Set(['data', 'pipeline', 'reference']);
const TEXT = /\.(tsx?|m?js|cjs|py|json|jsonc|html|css|md|ya?ml|toml|txt|svg|xml|sh)$/;
function* liveFiles(dir = ROOT): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(ROOT, path);
    if (statSync(path).isDirectory()) {
      if (SKIP_DIRS.has(name) || (dir === ROOT && SKIP_TOP.has(name))) continue;
      if (rel === join('packages', 'ingest', 'src', 'production', 'historical')) continue;
      yield* liveFiles(path);
    } else if (TEXT.test(name)) yield rel;
  }
}

describe('the icons of СИГМА', () => {
  it.each(Object.entries(COPIED_FROM_SIGMA))(
    '%s is the byte copy of the СИГМА file',
    (name, hash) => {
      expect(sha256(pub(name))).toBe(hash);
    },
  );

  it('the mark that make_images.py draws from is the unchanged logo-icon.svg of СИГМА', () => {
    const mark = readFileSync(
      fileURLToPath(new URL('../../scripts/sigma-mark.svg', import.meta.url)),
    );
    expect(sha256(mark)).toBe('6e7414ed2b69f45e92fb07e7cb671d898490eb03d1bbc10c94451763f8a76d6b');
  });

  it('the document drawn by root.tsx declares the four icons of СИГМА and the manifest', () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: () => (
          <Layout>
            <main />
          </Layout>
        ),
      },
    ]);
    const html = renderToString(<Stub initialEntries={['/']} />);
    expect(headLinks(html)).toEqual([...ICON_LINKS, { rel: 'manifest', href: '/manifest.json' }]);
    expect(html).not.toContain(OLD_FAVICON);
  });

  it('the legacy shell public/index.html (app.html offline) declares the same links', () => {
    const html = pub('index.html').toString('utf8');
    expect(headLinks(html)).toEqual([...ICON_LINKS, { rel: 'manifest', href: '/manifest.json' }]);
    expect(html).not.toContain(OLD_FAVICON);
  });

  it('every icon of manifest.json exists with its declared size and is a valid maskable tile', () => {
    const manifest = JSON.parse(pub('manifest.json').toString('utf8'));
    expect(manifest.icons.map((i: { src: string }) => i.src)).toEqual([
      '/icon-192.png',
      '/icon-512.png',
    ]);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      const { width, height, rgb } = decodePng(pub(icon.src.slice(1)));
      expect(`${width}x${height}`).toBe(icon.sizes);
      // a full-bleed tile in the red of СИГМА
      for (const [x, y] of [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ])
        expect(rgb(x, y)).toEqual(TILE);
      if (icon.purpose.split(' ').includes('maskable')) {
        // the white mark lies inside the safe zone of a maskable icon: the circle of 40% of the side around the centre
        const c = (width - 1) / 2;
        let far = 0,
          white = 0;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++)
            if (rgb(x, y)[1] > 128) {
              white++;
              far = Math.max(far, Math.hypot(x - c, y - c));
            }
        expect(white).toBeGreaterThan(width * height * 0.05);
        expect(far).toBeLessThanOrEqual(width * 0.4);
      }
    }
  });

  it('the social card keeps its size for og:image:width/height', () => {
    expect(pngSize(pub('og.png'))).toEqual([1200, 630]);
  });

  it('no live file names the old SVG favicon or carries the bar-chart mark', () => {
    const offenders: string[] = [];
    for (const rel of liveFiles()) {
      const text = readFileSync(join(ROOT, rel), 'utf8');
      if (text.includes(OLD_FAVICON) || BAR_MARK.some((m) => text.includes(m))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
