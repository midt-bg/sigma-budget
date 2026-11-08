/** Transform the two pairs of annex grids captured by the independent law reader.
 * Raw HTML and PDF reading remains in Python until the extraction wave.
 */
export type LawBlock = ['p', string] | ['t', string[][]];
export interface MinimumIncomeRow {
  no: number;
  code: string;
  name: string;
  until: (number | null)[];
  from: (number | null)[];
}
export interface ActivityRate {
  code: string;
  name: string;
  until: number;
  from: number;
}
export interface RatesAnnexes {
  groups: string[];
  minimumIncome: MinimumIncomeRow[];
  minimumNotes: string[];
  activities: ActivityRate[];
  activityNote: string;
  nameFixes: number;
}
const ws = (s: string) => (s ?? '').replace(/\s+/gu, ' ').trim();
const fixName = (s: string) => ws(s).replaceAll('Произовдство', 'Производство').replace(/началник-\s*клиника/gu, 'началник клиника');
const number = (s: string): number | null => {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)/u.exec(s ?? '');
  return match ? Number(match[1]!.replace(',', '.')) : null;
};
function paragraph(blocks: LawBlock[], prefix: string, after = 0): number {
  const i = blocks.findIndex((b, index) => index >= after && b[0] === 'p' && b[1].startsWith(prefix));
  if (i < 0) throw new Error(`rates: paragraph starting ${prefix} not found`);
  return i;
}
function tableAfter(blocks: LawBlock[], heading: string): string[][] {
  const i = paragraph(blocks, heading);
  for (let j = i + 1; j < Math.min(i + 6, blocks.length); j++) {
    const block = blocks[j]!;
    if (block[0] === 't') return block[1];
  }
  throw new Error(`rates: no table after ${heading}`);
}
function notesAfter(blocks: LawBlock[], heading: string, stop: string): string[] {
  const start = paragraph(blocks, 'Забележки:', paragraph(blocks, heading) + 1);
  const end = paragraph(blocks, stop, start + 1);
  return blocks.slice(start + 1, end).flatMap((b) => b[0] === 'p' ? [ws(b[1])] : []);
}
const section = (s: string) => ws(s).replace(/[АВЕСНКМОРТХ]/gu, (c) => ({А:'A',В:'B',Е:'E',С:'C',Н:'H',К:'K',М:'M',О:'O',Р:'P',Т:'T',Х:'X'} as Record<string,string>)[c]!);
const sameRow = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

export function transformRatesAnnexes(blocks: LawBlock[]): RatesAnnexes {
  const h1 = 'Приложение № 1 към чл. 9', h1a = 'Приложение № 1А към чл. 9';
  const h2 = 'Приложение № 2 към чл. 14', h2a = 'Приложение № 2А към чл. 14';
  const a = tableAfter(blocks, h1), b = tableAfter(blocks, h1a);
  if (!a[0] || !a[1] || !b[0] || !b[1] || a[0].length !== 13 || !sameRow(a[0], b[0]) || !sameRow(a[1], b[1]))
    throw new Error('rates: Приложения 1 and 1А have different headers');
  const groups = a[0].slice(4).map(ws);
  let nameFixes = 0;
  if (a.length !== b.length) throw new Error('rates: Приложения 1 and 1А row numbering is not 1..n');
  const minimumIncome = a.slice(2).map((row, index): MinimumIncomeRow => {
    const other = b[index + 2]!;
    const name = fixName(row[3]!), otherName = fixName(other[3]!);
    nameFixes += Number(name !== ws(row[3]!)) + Number(otherName !== ws(other[3]!));
    const sec = section(row[1]!);
    if (!(/^(?:[A-V](?:, [A-V])*)?$/u.test(sec) && sec === section(other[1]!) && row[0] === other[0] && ws(row[2]!) === ws(other[2]!) && name === otherName))
      throw new Error(`rates: Приложения 1 and 1А are not aligned at row ${row[0]}`);
    if (Number(row[0]) !== index + 1) throw new Error('rates: Приложения 1 and 1А row numbering is not 1..n');
    const parse = (cells: string[]) => cells.slice(4).map((cell) => {
      const value = number(cell);
      if (cell && value === null) throw new Error(`rates: non-numeric minimum insurable income in row ${row[0]}`);
      return value;
    });
    const until = parse(row), from = parse(other);
    if (until.length !== groups.length || from.length !== groups.length || until.some((v, i) => (v === null) !== (from[i] === null)))
      throw new Error('rates: a minimum-income cell is empty in only one of Приложения 1 and 1А');
    return { no: Number(row[0]), code: ws(row[2]!), name, until, from };
  });
  const notes1 = notesAfter(blocks, h1, h1a), notes2 = notesAfter(blocks, h1a, h2);
  const normalized = (notes: string[]) => notes.map((n) => ws(n).toLowerCase().replaceAll('№ ', '№'));
  if (!sameRow(normalized(notes1), normalized(notes2))) throw new Error('rates: the notes under Приложения 1 and 1А differ');
  const x = tableAfter(blocks, h2), y = tableAfter(blocks, h2a);
  const index = (table: string[][]) => {
    const rows = table.slice(2), map = new Map(rows.map((row) => [ws(row[0]!), row]));
    if (map.size !== rows.length) throw new Error('rates: duplicate activity code');
    return map;
  };
  const xa = index(x), ya = index(y);
  if (xa.size !== ya.size || [...xa.keys()].some((code) => !ya.has(code))) throw new Error('rates: Приложения 2 and 2А do not list the same activity codes');
  const activities = [...xa.keys()].sort().map((code): ActivityRate => {
    const left = xa.get(code)!, right = ya.get(code)!;
    const name = fixName(left[1]!), other = fixName(right[1]!);
    if (name !== other) throw new Error(`rates: activity ${code} is named differently`);
    nameFixes += Number(name !== ws(left[1]!)) + Number(other !== ws(right[1]!));
    const until = number(left[2]!), from = number(right[2]!);
    if (until === null || from === null) throw new Error('rates: a ТЗПБ rate is missing');
    return { code, name, until, from };
  });
  const noteIndex = paragraph(blocks, 'Забележка:', paragraph(blocks, h2));
  const note = blocks[noteIndex + 1];
  if (!note || note[0] !== 'p') throw new Error('rates: activity note missing');
  return { groups, minimumIncome, minimumNotes: notes2, activities, activityNote: ws(note[1]), nameFixes };
}

export interface ContributionRow {
  page: number;
  label: string;
  cells: string[];
}
export interface FundRates {
  doo: number;
  upf: number;
  health: number;
}
export interface ContributionSplit {
  total: FundRates;
  employee: FundRates;
  employer: FundRates;
}
const requiredContributionRows = ['1.1.', '1.2.', '5.1.2.', '5.2.2.', '10.1.2.', '10.2.2.'] as const;
/** Read the NAP reader's 15-column grid and check each total against both shares. */
export function transformContributionRows(rows: Record<string, ContributionRow>): Record<string, ContributionSplit> {
  const output: Record<string, ContributionSplit> = {};
  for (const id of requiredContributionRows) {
    const row = rows[id];
    if (!row || row.cells.length !== 15) throw new Error(`rates: missing 15-column NAP row ${id}`);
    const funds = (offset: number): FundRates => ({
      doo: number(row.cells[offset]!) ?? 0,
      upf: number(row.cells[offset + 1]!) ?? 0,
      health: number(row.cells[offset + 2]!) ?? 0,
    });
    const split = { total: funds(4), employee: funds(8), employer: funds(12) };
    for (const fund of ['doo', 'upf', 'health'] as const) {
      if (Math.abs(split.total[fund] - split.employee[fund] - split.employer[fund]) >= 0.0051)
        throw new Error(`rates: NAP row ${id}: ${fund} total differs from employee and employer shares`);
    }
    output[id] = split;
  }
  return output;
}
