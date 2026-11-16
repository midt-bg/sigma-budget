// One selected period, without borrowing a missing figure from another year or vintage.
import { html } from '../html.js';
import { num, moneyParts, DASH } from '../format.js';
import { selectPeriod } from '../periods.js';
import { block } from './block.js';
import { kpi, kpiGrid } from './kpi.js';

export function debtKeyFigures(ctx, { mln, pg, scope, source, asOf }) {
  const period = ctx.period;
  const outlook = ctx.data.outlook;
  const record = selectPeriod(outlook, period.key);
  const interest = record.legacy
    ? outlook?.kfp?.interest?.mln?.[record.column]
    : record.series?.interest?.value;
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  const ip = ok(interest) ? moneyParts(interest) : null;
  const tile = (label, value, unit, when) =>
    kpi({
      label,
      value: value ?? DASH,
      unit: value == null ? '' : unit,
      sub: html`${when}${value == null ? html`<br />Няма данни за периода` : ''}`,
    });
  return block({
    id: 's17-b-kpi',
    title: 'Накратко: колко дължим',
    scope,
    source: [...new Set([...source, ...(record.sourceRefs || outlook?.meta?.source || [])])],
    asOf,
    status: period.status === 'report' ? 'real' : 'forecast',
    statusLabel: period.label,
    share: { period: period.key },
    body: kpiGrid(
      [
        tile('Дълг спрямо БВП', ok(pg) ? num(pg, 1) : null, '%', `31.12.${period.year}`),
        tile('Общ дълг', ok(mln) ? num(mln / 1000, 2) : null, 'млрд. €', `31.12.${period.year}`),
        tile('Лихви за годината', ip?.v, ip?.u, `${period.year} г.`),
      ],
      { label: `Дълг и лихви · ${period.label}`, cls: 's17-key-figures' },
    ),
  });
}
