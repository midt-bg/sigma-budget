import {
  test,
  screenStep,
  evaluate,
  routes,
  cells,
  withQuery,
  audit,
  collect,
  problemFindings,
  report,
  type Finding,
} from '../screens-helpers.ts';
test.use({ serviceWorkers: 'block' });
const STATES = {
  loading: '[data-state="loading"]',
  empty: '.state-empty[data-state="empty"]',
  error: '.state-error[data-state="error"]',
  pending: '.state-pending[data-state="pending"]',
};
for (const route of routes)
  test(`screen states ${route.id}`, async ({ screens, discovery }) => {
    test.setTimeout(600_000);
    for (const demo of [...Object.keys(STATES), 'offline'])
      for (const cell of ['S01', 'S06', 'S28'].includes(route.id) ? cells : cells.slice(0, 1))
        await screenStep(`${demo} ${cell}`, async () => {
          const hash = withQuery(route.samples[0]!, { demo });
          const o = await screens.open(cell, hash);
          const fs: Finding[] = [];
          const F = (code: string, msg: string) => fs.push({ level: 'fail', code, msg });
          try {
            if (!o.ok) {
              F('timeout', o.why);
              return;
            }
            const a = await audit(o.page, route.id);
            fs.push(...(await collect(o)), ...problemFindings(a));
            if (demo === 'offline') {
              const st = await evaluate<{
                vis: boolean;
                state: string;
                text: string;
              } | null>(
                o.page,
                `() => { const e = document.getElementById('offline'); if (!e) return null;
              const r = e.getBoundingClientRect(); return { vis: !e.hidden && r.height > 0, state: e.dataset.state || '', text: e.textContent.trim().slice(0,80) }; }`,
              );
              if (!st?.vis)
                F('demo-offline', 'demo=offline did not show the offline banner (#offline)');
              else if (st.state !== 'offline' || !st.text)
                F('demo-offline', 'the offline banner lacks state or text: ' + JSON.stringify(st));
              if (!['ready', 'empty', 'pending'].includes(a.info.view))
                F('demo-offline', 'demo=offline must keep the real screen: ' + a.info.view);
              return;
            }
            if (a.info.view !== demo) F('demo-state', `expected ${demo}, got ${a.info.view}`);
            const n = await evaluate<number>(
              o.page,
              "(sel) => [...document.querySelectorAll('#view ' + sel)].filter(e => e.getBoundingClientRect().height > 0).length",
              STATES[demo as keyof typeof STATES],
            );
            if (!n) F('demo-state', `demo=${demo}: no visible state component`);
            else if (
              demo === 'loading' &&
              !(await evaluate(
                o.page,
                '() => !!document.querySelector(\'#view [data-state="loading"][role="status"]\')',
              ))
            )
              F('demo-state', 'the loading skeleton lacks role="status"');
            else if (
              demo === 'error' &&
              !(await evaluate(
                o.page,
                '() => !!document.querySelector(\'#view .state-error[role="alert"] button[data-action="retry"]\')',
              ))
            )
              F('demo-state', 'the error state needs role="alert" and retry');
            if (
              route.next.length &&
              !(await evaluate(o.page, "() => !!document.querySelector('#view aside.next')"))
            )
              fs.push({
                level: 'warn',
                code: 'demo-next',
                msg: `demo=${demo}: the „Следва“ card is missing from the frame`,
              });
          } finally {
            report([...fs, ...(await collect(o))], `${route.id} ${cell} ${hash}`);
          }
        });
    // Require the discovery fixture for the original built-catalogue check.
    void discovery;
  });
