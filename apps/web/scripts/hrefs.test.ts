import { expect, it } from 'vitest';
import { addresses, destination } from './hrefs.ts';
it('retains the exact Python token and comment rule', () => {
  const source = `
    // #/comment?x=1&y=2
    const a = '#/path?x=1&y=2'; const b = '#/x?y'; const c = '#/x';
    /* #/block-comment */
    const d = 1; // #/inline-comment
    a#/ignored &amp;#/ignored е#/ignored ²#/ignored
    '#/' '#/:' '#/end...' '#/percent%20path?x=a+b&y=c,d:e.f'
  `;
  expect(addresses(source, true)).toEqual([
    '#/path?x=1&y=2',
    '#/x?y',
    '#/x',
    '#/block-comment',
    '#/inline-comment',
    '#/ignored',
    '#/end',
    '#/percent%20path?x=a+b&y=c,d:e.f',
  ]);
  expect(addresses('// #/json', false)).toEqual(['#/json']);
  expect(destination('#/definitely-missing-route').id).toBeNull();
  expect(destination('#/prihodi/%ZZ').id).toBeNull();
  expect(destination('#/za-proekta').id).toBe('S24');
});

it('scans release JSON and current JS, excluding vendor and other suffixes', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { collect } = await import('./hrefs.ts');
  const root = mkdtempSync(join(tmpdir(), 'hrefs-'));
  try {
    for (const dir of ['data/release/nested', 'apps/web/client/vendor', 'apps/web/public'])
      mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, 'data/release/nested/links.json'), '"#/prihodi?x=1&y=2"');
    writeFileSync(join(root, 'apps/web/client/links.js'), '// #/ignored\nconst link = "#/dead";');
    writeFileSync(join(root, 'apps/web/client/vendor/ignore.js'), '"#/vendor"');
    writeFileSync(join(root, 'apps/web/public/ignore.html'), '"#/html"');
    const found = collect(root);
    expect([...found.keys()].sort()).toEqual(['#/dead', '#/prihodi?x=1&y=2']);
    expect(destination('#/dead').id).toBeNull();
    expect(destination('#/prihodi?x=1&y=2').id).toBe('S06');
    expect([...found.get('#/prihodi?x=1&y=2')!]).toEqual(['data/release/nested/links.json']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
