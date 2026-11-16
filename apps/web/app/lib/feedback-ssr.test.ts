import { expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { provideScope } from '../../client/env.js';
import { parse } from '../../client/data.js';
import { requestState } from '../../client/store.js';
import { build, frameHtml, resolve } from '../../client/render.js';

const load = async (name: string) =>
  parse(
    name,
    readFileSync(new URL(`../../../../data/release/${name}.json`, import.meta.url), 'utf8'),
  );
afterEach(() => provideScope(() => null));
async function documentAt(address: string, turnstileSiteKey?: string) {
  const url = new URL(address, 'https://budget.test');
  const route = resolve(address);
  const scope = {
    url,
    origin: url.origin,
    ...(turnstileSiteKey === undefined ? {} : { turnstileSiteKey }),
    state: requestState(route.query.per),
    data: new Map(),
    load,
  };
  provideScope(() => scope);
  return parseHTML(String(frameHtml(await build(route.route, route.params, route.query)))).document;
}

it.each(['/vrazka', '/rechnik/kfp'])(
  '%s explains an unavailable sender without a site key',
  async (path) => {
    const doc = await documentAt(path, '');
    expect(doc.querySelector('[data-feedback-status]')?.textContent).toContain(
      'Изпращането временно не е достъпно',
    );
  },
);
it('preserves block value context for submission', async () => {
  const doc = await documentAt('/vrazka?val=123%20EUR', 'test-site-key');
  expect(doc.querySelector('input[name="val"]')?.getAttribute('value')).toBe('123 EUR');
  expect(doc.querySelector('[data-feedback-status]')?.textContent).toBe('');
});
