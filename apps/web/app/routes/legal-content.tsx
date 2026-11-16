// S36 „Поверителност“ and S37 „Условия за ползване“: the React body of the shared copy (client/legal.js; the legacy twin is legalHtml there).
import { PAGES, UPDATED, partsOf, target } from '../../client/legal.js';

type Part = string | { route?: unknown[]; url?: string; text?: string; contact?: boolean };
type Item = { p?: Part | Part[]; list?: (Part | Part[])[] };

export const needs = [];

function Parts({ value }: { value: Part | Part[] }) {
  return (
    <>
      {(partsOf(value) as Part[]).map((x, i) => {
        if (typeof x === 'string') return x;
        const t = target(x) as { href: string; text: string };
        return (
          <a key={i} href={t.href}>
            {t.text}
          </a>
        );
      })}
    </>
  );
}

export function LegalBody({ screen }: { screen: 'S36' | 'S37' }) {
  const sections = PAGES[screen] as { id: string; title: string; body: Item[] }[];
  return (
    <div className="legal">
      {sections.map((s) => (
        <section key={s.id} className="legal-block" aria-labelledby={s.id}>
          <h2 id={s.id} tabIndex={-1}>
            {s.title}
          </h2>
          {s.body.map((b, i) =>
            b.list ? (
              <ul key={i}>
                {b.list.map((li, j) => (
                  <li key={j}>
                    <Parts value={li} />
                  </li>
                ))}
              </ul>
            ) : (
              <p key={i}>
                <Parts value={b.p!} />
              </p>
            ),
          )}
        </section>
      ))}
      <p className="legal-updated">Последна промяна: {UPDATED}</p>
    </div>
  );
}
