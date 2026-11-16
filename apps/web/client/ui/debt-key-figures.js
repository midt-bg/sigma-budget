// One selected period, without borrowing a missing figure from another year or vintage.
import { html } from '../html.js';
import { num, moneyParts, date, EUR_RATE, NBSP, DASH } from '../format.js';
import { selectPeriod } from '../periods.js';
import { block } from './block.js';
import { kpi, kpiGrid } from './kpi.js';

const ok = (v) => typeof v === 'number' && Number.isFinite(v);
const levTxt = (mln) => {
  const v = mln * EUR_RATE;
  const billions = Math.abs(v) >= 1000;
  return html`≈${NBSP}${num(billions ? v / 1000 : v, billions ? 2 : 1)}${NBSP}<wbr />${billions ? 'млрд.' : 'млн.'}${NBSP}лв.`;
};

export function debtKeyFigures(ctx, { mln, pg, scope, source, asOf, debtReason }) {
  const period = ctx.period;
  const outlook = ctx.data.outlook;
  const record = selectPeriod(outlook, period.key);
  const interest = record.legacy
    ? outlook?.kfp?.interest?.mln?.[record.column]
    : record.series?.interest?.value;
  const ip = ok(interest) ? moneyParts(interest) : null;
  const missingDebt =
    debtReason ||
    (scope === 'maastricht'
      ? 'По Маастрихт няма прогноза за тази година.'
      : 'Няма публикуван ред за дълга по ЗДД за периода');
  const interestDate = record.legacy ? outlook?.meta?.asOf : record.publication;
  const prelim = record.legacy && outlook?.vintage?.[record.column] === 'prelim';
  const values = [ok(pg) ? num(pg, 1) : null, ok(mln) ? num(mln / 1000, 2) : null, ip?.v ?? null];
  const units = ['%', 'млрд. €', ip?.u || ''];
  const labels = ['Дълг спрямо БВП', 'Общ дълг', 'Лихви за годината'];
  const years = [`31.12.${period.year}`, `31.12.${period.year}`, `${period.year} г.`];
  const dates = [asOf, asOf, interestDate];
  const reasons = [missingDebt, missingDebt, 'Няма публикувани лихви по КФП за периода'];
  const text = values
    .map(
      (value, i) =>
        `${labels[i]} (${years[i]}): ${value == null ? `${DASH} ${reasons[i]}` : `${value}${NBSP}${units[i]}`}${i === 2 ? ` по КФП${prelim ? ', предварителни' : ''}` : ''}${dates[i] ? `; данни към ${date(dates[i])}` : ''}.`,
    )
    .join(' ');
  const tile = (i, gl, mln) =>
    kpi({
      label: labels[i],
      gl,
      value: values[i] ?? DASH,
      unit: values[i] == null ? '' : units[i],
      status: values[i] == null ? 'pending' : undefined,
      sub: html`${years[i]}${i === 2 ? html` · <abbr title="консолидирана фискална програма">КФП</abbr>${prelim ? ' · предварителни' : ''}` : ''}${dates[i] ? html`<br />Данни към ${date(dates[i])}` : ''}${values[i] == null ? html`<br />${reasons[i]}` : ''}${ctx.store.get('leva') && ok(mln) ? html`<br />${levTxt(mln)}` : ''}`,
    });
  return block({
    id: 's17-b-kpi',
    title: 'Накратко: колко дължим',
    scope,
    source: [...new Set([...source, ...(record.sourceRefs || outlook?.meta?.source || [])])],
    asOf: [asOf, interestDate].filter(Boolean).sort().pop(),
    status: ['report', 'law'].includes(period.status) ? 'real' : 'forecast',
    statusLabel: period.label,
    share: { period: period.key, text },
    body: kpiGrid(
      [tile(0, 'dyal-ot-bvp'), tile(1, 'darzhaven-dalg', mln), tile(2, 'lihva', interest)],
      { label: `Дълг и лихви · ${period.label}`, cls: 's17-key-figures' },
    ),
  });
}
