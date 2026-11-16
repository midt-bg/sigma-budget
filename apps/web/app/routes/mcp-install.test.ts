import { afterEach, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MigratedScreen } from '../migration/registry';
import { parseHTML } from 'linkedom';
import { provideScope } from '../../client/env.js';
import { requestState } from '../../client/store.js';
import { renderScreen } from '../lib/screen.server';
import inputs from './__fixtures__/metadata-inputs.json';

const docs: Record<string, unknown> = inputs;
afterEach(() => provideScope(() => null));
it.each(['https://staging.example', 'https://sigma-budget.midt.bg'])(
  'shows copyable MCP instructions at the configured origin %s',
  async (origin) => {
    const release = { id: 'test', dataBase: '/data/', origin, sigmaUrl: '', turnstileSiteKey: '' };
    const load = async <T>(name: string) => docs[name] as T;
    provideScope(() => ({
      url: new URL('https://request.example/api'),
      ...release,
      releaseId: release.id,
      state: requestState(null),
      data: new Map(),
      load,
    }));
    const result = await renderScreen(new URL('https://request.example/api'), release);
    if ('redirect' in result) throw new Error(result.redirect);
    const { document } = parseHTML(
      renderToStaticMarkup(
        createElement(MigratedScreen, {
          model: result.doc.model!,
          navigation: { go() {}, announce() {} },
        }),
      ),
    );
    const section = document.getElementById('s25-mcp')!.parentElement!;
    expect(section.textContent).toContain('Streamable HTTP');
    const examples = [...section.querySelectorAll('[data-s25-copy-from]')];
    for (const button of examples) {
      const code = document.getElementById(button.getAttribute('data-s25-copy-from')!)!;
      expect(code.textContent).toContain(origin + '/mcp');
      expect(code.textContent).not.toContain('request.example');
    }
    expect(document.getElementById('s25-mcp-claude-code')!.textContent).toBe(
      `claude mcp add --transport http --scope user sigma-budget ${origin}/mcp`,
    );
    expect(result.doc.title).toContain('Отворени данни и MCP');
    for (const tag of result.doc.tags.filter((tag) =>
      /description$/.test(tag.attrs.name || tag.attrs.property || ''),
    ))
      expect(tag.attrs.content).toContain('MCP');
  },
);
