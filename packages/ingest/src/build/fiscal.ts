import { isNumber } from '../io/data.js';
import { YEARS, type TableRow } from './annex.js';

/** Cleaned Table VI-1 evidence, independently extracted from the source document. */
export interface StateDebtTableInput {
  rows: TableRow[];
}

export interface StateDebtTable {
  totalMln: number[];
  totalPctGdp: number[];
  externalMln: number[];
  externalPctGdp: number[];
  domesticMln: number[];
  domesticPctGdp: number[];
  gdpMln: number[];
}

/** Table VI-1: state debt under the State Debt Act, not general-government debt. */
export function stateDebtTable(input: StateDebtTableInput): StateDebtTable {
  const rows = new Map(input.rows.map((row) => [row.label, row.values]));
  function required(label: string): number[] {
    const values = rows.get(label);
    if (!values || values.length !== 5 || !values.every(isNumber))
      throw new Error(`VI-1 ${label} is incomplete`);
    return [...values];
  }
  const result: StateDebtTable = {
    totalMln: required('Държавен дълг, млн. евро'),
    totalPctGdp: required('Държавен дълг/БВП (%)*'),
    externalMln: required('Външен дълг, млн. евро'),
    externalPctGdp: required('Външен дълг/БВП (%)'),
    domesticMln: required('Вътрешен дълг, млн. евро'),
    domesticPctGdp: required('Вътрешен дълг/БВП (%)'),
    gdpMln: required('БВП, млн. евро'),
  };
  for (let i = 0; i < YEARS.length; i++) {
    if (Math.abs(result.totalMln[i]! - result.externalMln[i]! - result.domesticMln[i]!) > 0.25)
      throw new Error(`VI-1: external + domestic != total in ${YEARS[i]}`);
  }
  return result;
}
