// Attribution follows the selected physical record, including its publication status.
import { selectPeriod } from '../periods.js';
import { html } from '../html.js';
import { date } from '../format.js';

export function annualSourceText(record) {
  if (!record?.available) return '';
  const published = record.publication ? ` Публикация от ${date(record.publication)} г.` : '';
  if (!record.legacy && record.sourceRefs?.includes('budget2027')) {
    const scope =
      record.status === 'law'
        ? 'Приет закон за 2026 г., Приложение 1.'
        : record.status === 'expected'
          ? 'Очаквано изпълнение за 2026 г., Приложение 3; оценка на МФ, не отчет.'
          : record.status === 'draft'
            ? `Проект за ${record.year} г., Приложение 3; не е приет закон.`
            : `Прогноза за ${record.year} г., Приложение 3.`;
    return `${scope} Източник: МФ, АСБП 2027–2029.${published}`;
  }
  if (record.legacy && ['plan', 'draft', 'forecast'].includes(record.vintage))
    return `Исторически проект за 2026 г. и прогнози към него.${published} Приетият закон може да се различава от проекта.`;
  return `Отчетни данни за ${record.year} г. от историческата серия.${published}`;
}

export function annualSource(ctx, dataset) {
  return html`${annualSourceText(dataset?.records?.find(r => r.periodKey === ctx.period.key) || selectPeriod(dataset, ctx.period.key))}`;
}
