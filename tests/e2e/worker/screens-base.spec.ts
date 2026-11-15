import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../../../apps/web/scripts/serve.ts';
import {
  test,
  screenStep,
  axeFindings,
  expect,
  routes,
  cells,
  audit,
  mergeAudits,
  deepPass,
  collect,
  problemFindings,
  report,
  type Finding,
} from '../screens-helpers.ts';
import { valueScan } from '../screens-values.ts';
test.use({ serviceWorkers: 'block' });
for (const route of routes)
  test(`screen audit ${route.id}`, async ({ screens, discovery }) => {
    // A Python job had its own timeout; keep enough test budget for every sample/cell and both deep audits.
    test.setTimeout(route.samples.length * cells.length * 120_000);
    expect(discovery.routes.some((r) => r.id === route.id)).toBe(true);
    const want = new Set<string>(),
      found = new Set<string>();
    for (const hash of route.samples)
      for (const cell of cells)
        await screenStep(`${cell} ${hash}`, async () => {
          const o = await screens.open(cell, hash);
          if (!o.ok) {
            report([...(await collect(o)), { level: 'fail', code: 'timeout', msg: o.why }], hash);
            return;
          }
          let fs: Finding[] = [];
          try {
            let result = await audit(o.page, route.id);
            if (process.env.E2E_SCREENS_SHOTS && hash === route.samples[0]) {
              const directory = join(ROOT, 'tmp/render-check-v6');
              await mkdir(directory, { recursive: true });
              await o.page.screenshot({ path: join(directory, `${route.id}-${cell}.png`) });
            }
            await deepPass(o.page);
            result = mergeAudits(result, await audit(o.page, route.id, true));
            fs = await collect(o);
            const pending = new Set(
              fs
                .filter((f) => f.code === 'pending-data')
                .map((f) => f.msg.split(' -> ')[0]!.split('/').at(-1)!),
            );
            fs.push(...problemFindings(result), ...(await axeFindings(o.page)));
            if (result.info.view === 'ready') {
              const vals = await valueScan(o.page, route.id, pending, true);
              for (const v of vals?.want || []) want.add(v);
              for (const v of vals?.found || []) found.add(v);
            }
          } finally {
            report([...fs, ...(await collect(o))], `${route.id} ${cell} ${hash}`);
          }
        });
    // Python value_findings unions every base load of a route, rather than demanding each sample show every value.
    expect
      .soft(
        [...want].filter((v) => !found.has(v)).sort(),
        route.id + ': expected values across all samples/cells',
      )
      .toEqual([]);
  });
