// Data status (plan 2.2 / DATA_SPEC §1): real | partial | mock | forecast.
// A status is never colour alone: every pill carries an icon and words; mock is also hatched (▨).
//   statusPill('mock')  ·  statusPill('real', {label:'Към 31.07.2026'})  ·  openLegend()

import { icon } from './Icon';

export const STATUS = {
  real: {
    label: 'Официални данни',
    icon: 'checkCircle',
    text: 'Взети от официален източник. Показваме откъде са и към коя дата.',
  },
  partial: {
    label: 'Частични данни',
    icon: 'partial',
    text: 'Част от показателя е официална, друга част още липсва или е изчислена. Бележката до числото казва коя.',
  },
  forecast: {
    label: 'Прогноза',
    icon: 'forecast',
    text: 'Официална оценка за бъдещи години. Това не е отчет и може да се промени.',
  },
  mock: {
    label: 'Примерни данни',
    icon: 'hatch',
    text: 'Измислени стойности, които показват как ще изглежда екранът. Не са истински и не бива да се цитират. Белязани са със щриховка ▨.',
  },
};
export type DataStatus = keyof typeof STATUS;
export const statusLabel = (s: string) => STATUS[s as DataStatus]?.label || 'Няма данни';

/** statusPill('real') -> <span class="st" data-st="real">✓ Официални данни</span> */
export function statusPill(status: string, o: { label?: string } = {}) {
  if (!(status in STATUS)) return null;
  const key = status as DataStatus;
  const s = STATUS[key];
  return (
    <>
      <span className="st" data-st={key}>
        {icon(s.icon, { size: 14 })}
        <span>{o.label || s.label}</span>
      </span>
    </>
  );
}
