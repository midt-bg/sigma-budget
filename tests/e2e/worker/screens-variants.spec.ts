import {
  test,
  screenStep,
  evaluate,
  routes,
  withQuery,
  prefBlob,
  pickCell,
  audit,
  collect,
  problemFindings,
  report,
  type Finding,
} from '../screens-helpers.ts';
test.use({ serviceWorkers: 'block' });
const PREF_SETS = [
  { unit: 'pct' },
  { perPerson: true, leva: true },
  { unit: 'pct', perPerson: true, leva: true },
  { onlyReal: true },
];
for (const check of ['period', 'user', 'prefs'] as const)
  for (const [index, route] of routes.entries()) {
    if (check === 'period' && route.periods === 'none') continue;
    test(`screen ${check} ${route.id}`, async ({ screens, discovery }) => {
      test.setTimeout(600_000);
      const cases =
        check === 'period' ? discovery.periods : check === 'user' ? discovery.users : PREF_SETS;
      // Python increments k before assigning cells; period excludes periods=none routes before incrementing.
      const preceding =
        check === 'period'
          ? routes.slice(0, index).filter((r) => r.periods !== 'none').length
          : index;
      for (const [i, value] of cases.entries())
        await screenStep(JSON.stringify(value), async () => {
          const cell = pickCell(preceding * cases.length + i + 1);
          const per = check === 'period' ? String(value) : '';
          const hash = per ? withQuery(route.samples[0]!, { per }) : route.samples[0]!;
          const prefs =
            check === 'user'
              ? prefBlob({ userType: value })
              : check === 'prefs'
                ? prefBlob(value as Record<string, unknown>)
                : {};
          const o = await screens.open(cell, hash, prefs);
          const fs: Finding[] = [];
          const F = (code: string, msg: string) => fs.push({ level: 'fail', code, msg });
          try {
            if (!o.ok) {
              F('timeout', o.why);
              return;
            }
            const a = await audit(o.page, route.id);
            fs.push(...(await collect(o)), ...problemFindings(a));
            if (check === 'period') {
              const supported = route.periods === 'all' || route.periods.includes(per);
              if (supported) {
                if (a.info.view === 'error') F('period', `supported period ${per} ends in error`);
                if (a.info.view === 'empty')
                  fs.push({
                    level: 'warn',
                    code: 'period-empty',
                    msg: `supported period ${per} shows empty`,
                  });
              } else if (a.info.view !== 'empty')
                F('period', `unsupported period ${per}: expected empty, got ${a.info.view}`);
              else if (
                !(await evaluate(
                  o.page,
                  '() => document.querySelectorAll(\'#view [data-state="empty"] [data-action="set-period"]\').length',
                ))
              )
                F('period', 'no set-period button in unsupported period empty state');
            } else if (check === 'user') {
              const [got, roles] = await evaluate<[string, boolean]>(
                o.page,
                "async () => { const s = await import('./js/store.js'); return [s.store.get('userType'), s.ROLE_SELECTOR]; }",
              );
              if (got !== (roles ? value : 'citizen'))
                F('user', `stored userType ${value} gave ${got} (roles ${roles})`);
            } else {
              const snap = await evaluate<Record<string, unknown>>(
                o.page,
                "async () => (await import('./js/store.js')).store.snapshot()",
              );
              const bad = Object.entries(value).filter(
                ([k, v]) =>
                  snap[k] !==
                  (['perPerson', 'leva', 'onlyReal', 'sources'].includes(k) ? false : v),
              );
              if (bad.length)
                F(
                  'prefs',
                  `stored preference not applied (or removed switch read): ${JSON.stringify({ bad, snap })}`,
                );
              if (
                !route.bare &&
                (await evaluate(
                  o.page,
                  "() => document.querySelectorAll('[data-block-hidden]').length",
                ))
              )
                F('only-real', 'a block is hidden by the removed «Само официални данни» switch');
            }
          } finally {
            report([...fs, ...(await collect(o))], `${route.id} ${cell} ${hash}`);
          }
        });
    });
  }
