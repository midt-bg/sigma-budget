import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { byId } from '../client/routes.js';
import { destination } from './hrefs.ts';

it('every guide and glossary link reaches a site route or screen', () => {
  const links: string[] = [];
  function visit(value: unknown) {
    if (typeof value === 'string') {
      // Includes links embedded in editorial HTML or Markdown as well as href fields.
      for (const m of value.matchAll(/(?:#\/|(?<=href=["'])\/)[^\s<>"')\]]*/g)) links.push(m[0]);
    } else if (value && typeof value === 'object') {
      const screen = value as { id?: string; href?: string };
      if (screen.id?.match(/^S\d{2}$/)) {
        expect(byId[screen.id], screen.id).toBeDefined();
        if (screen.href) expect(destination(screen.href).id, screen.href).toBe(screen.id);
      }
      for (const [key, child] of Object.entries(value)) {
        if (
          key === 'href' &&
          typeof child === 'string' &&
          !/^(?:[a-z][\w+.-]*:|\/\/|#(?!\/))/i.test(child)
        )
          links.push(
            child.startsWith('#/') ? child : new URL(child, 'https://budget.test/').pathname,
          );
        visit(child);
      }
    }
  }
  for (const file of ['guide', 'glossary'])
    visit(
      JSON.parse(
        readFileSync(new URL(`../../../data/release/${file}.json`, import.meta.url), 'utf8'),
      ),
    );
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(destination(link).id, link).not.toBeNull();
});
