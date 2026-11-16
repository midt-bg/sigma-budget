import { afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { renderScreen } from './screen.server';
import { provideScope } from '../../client/env.js';
import { requestState } from '../../client/store.js';
import { parse } from '../../client/data.js';
import { index } from '../../client/glossary-scan.js';
import glossary from '../../../../data/release/glossary.json';

const descriptions = {
  'balansiran-byudzhet':
    'Бюджет, при който приходите и разходите са равни. Бюджетното салдо е нула: няма нито дефицит, нито излишък.',
  'byudzheten-transfer':
    'Прехвърляне на средства от един бюджет към друг. В консолидираната фискална програма трансферите между бюджетите се изключват, за да не се броят два пъти.',
};
afterEach(() => provideScope(() => null));

for (const [slug, description] of Object.entries(descriptions)) {
  it(`${slug} uses editorial meta tags while preserving the published definition in SSR and glossary popups`, async () => {
    const url = new URL(`/rechnik/${slug}`, 'https://budget.test');
    const load = async (name: string) =>
      parse(
        name,
        readFileSync(new URL(`../../../../data/release/${name}.json`, import.meta.url), 'utf8'),
      );
    provideScope(() => ({
      url,
      origin: url.origin,
      state: requestState(null),
      data: new Map(),
      load,
    }));
    const result = await renderScreen(url, {
      id: '',
      dataBase: '/data/',
      origin: url.origin,
      sigmaUrl: '',
      turnstileSiteKey: '',
    });
    if (!('doc' in result)) throw new Error('Unexpected redirect');
    const { doc } = result;
    expect(doc.status).toBe(200);
    const definition = glossary.terms.find((term) => term.slug === slug)!.def;
    const { document } = parseHTML(doc.view);
    expect(document.querySelector('.lede')?.textContent?.trim()).toBe(definition);
    expect(document.querySelector('article')!.textContent).not.toContain(description);
    expect(index(glossary).by.get(slug)?.def).toBe(definition);
    for (const key of ['description', 'og:description', 'twitter:description']) {
      expect(
        doc.tags.find((tag) => (tag.attrs.name || tag.attrs.property) === key)?.attrs.content,
      ).toBe(description);
    }
    const graph = JSON.parse(doc.ld)['@graph'];
    expect(
      graph.find((node: { '@type': string }) => node['@type'] === 'DefinedTerm').description,
    ).toBe(definition);
    expect(graph.find((node: { '@type': string }) => node['@type'] === 'WebPage').description).toBe(
      definition,
    );
  });
}
