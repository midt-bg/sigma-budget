// One selected period, without borrowing a missing figure from another year or vintage.
import { html } from '../html.js';
import { num, money, moneyParts, DASH } from '../format.js';
import { selectPeriod } from '../periods.js';
import { block } from './block.js';
import { kpi, kpiGrid } from './kpi.js';

export function debtKeyFigures(ctx, { mln, pg, scope, source, asOf, debtReason }) {
  const period = ctx.period;
  const outlook = ctx.data.outlook;
  const record = selectPeriod(outlook, period.key);
  const interest = record.legacy
    ? outlook?.kfp?.interest?.mln?.[record.column]
    : record.series?.interest?.value;
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  const ip = ok(interest) ? moneyParts(interest) : null;
  const missingDebt =
    debtReason ||
    (scope === 'maastricht'
      ? 'Методиката стига до 2025 г.'
      : 'Няма публикуван ред за дълга по ЗДД за периода');
  const lev = (v) =>
    ctx.store.get('leva') && ok(v)
      ? /\((≈.*)\)$/.exec(money(v, { leva: true }))?.[1]?.replaceAll('\u00a0', ' ')
      : '';
  const tile = (label, value, unit, when, { gl, reason, mln } = {}) =>
    kpi({
      label,
      gl,
      value: value ?? DASH,
      unit: value == null ? '' : unit,
      sub: html`${when}${value == null ? html`<br />${reason}` : ''}${lev(mln) ? html`<br />${lev(mln)}` : ''}`,
    });
  const interestDate = record.legacy ? outlook?.meta?.asOf : record.publication;
  const prelim = record.legacy && outlook?.vintage?.[record.column] === 'prelim';
  return block({
    id: 's17-b-kpi',
    title: 'Накратко: колко дължим',
    scope,
    source: [...new Set([...source, ...(record.sourceRefs || outlook?.meta?.source || [])])],
    asOf: [asOf, interestDate].filter(Boolean).sort().pop(),
    status: period.status === 'report' ? 'real' : 'forecast',
    statusLabel: period.label,
    share: { period: period.key },
    body: kpiGrid(
      [
        tile('Дълг спрямо БВП', ok(pg) ? num(pg, 1) : null, '%', `31.12.${period.year}`, {
          gl: 'dyal-ot-bvp',
          reason: missingDebt,
        }),
        tile('Общ дълг', ok(mln) ? num(mln / 1000, 2) : null, 'млрд. €', `31.12.${period.year}`, {
          gl: scope === 'zdd' ? 'darzhaven-dalg' : 'sektor-darzhavno-upravlenie',
          reason: missingDebt,
          mln,
        }),
        tile('Лихви по КФП', ip?.v, ip?.u, `${period.year} г.${prelim ? ' · предварителни' : ''}`, {
          gl: 'lihva',
          reason: 'Няма публикувани лихви по КФП за периода',
          mln: interest,
        }),
      ],
      { label: `Дълг и лихви · ${period.label}`, cls: 's17-key-figures' },
    ),
  });
}
