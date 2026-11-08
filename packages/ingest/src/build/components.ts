/** State budget transformation from the independently built law article 1. */
export interface StateLawLine {
  sec: string;
  no: string;
  text: string;
  law: number;
  level: number;
  header?: boolean;
}
export interface StateLaw {
  art1: { lines: StateLawLine[] };
}
export interface StateBudget {
  revKhil: number;
  taxKhil: number;
  nonTaxKhil: number;
  grantsKhil: number;
  expKhil: number;
  transfersNetKhil: number;
  euContributionKhil: number;
  balanceKhil: number;
  financingKhil: number;
  providedKhil: number;
  receivedKhil: number;
  nzokFromHealthMinistryKhil: number;
}
export interface StateTransfers {
  municipalities: number;
  doo: number;
  nzok: number;
  euNf: number;
  euDfz: number;
}
export interface StateResult {
  state: StateBudget;
  transfers: StateTransfers;
}
function same(label: string, a: number, b: number): void {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 0.051)
    throw new Error(`components: ${label} differs: ${a} vs ${b}`);
}
export function transformState(law: StateLaw): StateResult {
  const top = new Map<string, StateLawLine>(), sub = new Map<string, StateLawLine>();
  for (const line of law.art1.lines) {
    if (line.header) continue;
    if (!top.has(line.sec)) top.set(line.sec, line);
    if (line.level > 0) sub.set(`${line.sec}:${line.no}`, line);
  }
  function total(sec: string): number {
    const line = top.get(sec);
    if (!line) throw new Error(`components: missing state section ${sec}`);
    return line.law;
  }
  function row(sec: string, no: string, must: string): number {
    const line = sub.get(`${sec}:${no}`);
    if (!line || !line.text.toLowerCase().includes(must))
      throw new Error(`components: ЗДБ art. 1 row ${sec}.${no} expected ${must}`);
    return line.law;
  }
  const state: StateBudget = {
    revKhil: total('I'), taxKhil: row('I', '1', 'данъчни'), nonTaxKhil: row('I', '2', 'неданъчни'),
    grantsKhil: row('I', '3', 'помощи'), expKhil: total('II'), transfersNetKhil: total('III'),
    euContributionKhil: total('IV'), balanceKhil: total('V'), financingKhil: total('VI'),
    providedKhil: row('III', '1', 'предоставени трансфери'), receivedKhil: row('III', '2', 'получени трансфери'),
    nzokFromHealthMinistryKhil: row('III', '1.3.1', 'здравеопазването'),
  };
  const transfers: StateTransfers = {
    municipalities: row('III', '1.1', 'общините'), doo: row('III', '1.2', 'обществено осигуряване'),
    nzok: row('III', '1.3', 'здравноосигурителна каса'), euNf: row('III', '1.4', 'националния фонд'),
    euDfz: row('III', '1.5', 'земеделие'),
  };
  same('ЗДБ rev - exp - transfers - EU contribution = balance', state.revKhil - state.expKhil - state.transfersNetKhil - state.euContributionKhil, state.balanceKhil);
  same('ЗДБ financing = -balance', state.financingKhil, -state.balanceKhil);
  same('ЗДБ provided - received = net transfers', state.providedKhil - state.receivedKhil, state.transfersNetKhil);
  same('ЗДБ revenue = tax + non-tax + grants', state.taxKhil + state.nonTaxKhil + state.grantsKhil, state.revKhil);
  return { state, transfers };
}
