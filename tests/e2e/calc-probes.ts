// Browser probes and case lists preserved from calc_check.py.
export const JS_COMPUTE = `async cases => {
  const m = await import('./js/pages/s18-danaci.js');
  const rates = await (await fetch('./data/rates.json')).json();
  const core = await (await fetch('./data/core.json')).json();
  const assum = await (await fetch('./data/indirect-tax-parameters.json')).json();
  const ctx = { data: { rates, core, 'indirect-tax-parameters': assum }, core, store: { get: () => false }, period: {} };
  const env = m.getEnv(ctx);
  return cases.map(c => {
    const r = m.compute({ gross: String(c.gross), rules: c.rules, tzpb: c.tzpb ?? null, ind: false, purchases: '', fuel: '', tobacco: '' }, env);
    const o = { kind: r.kind, err: r.errors.gross };
    if (r.kind === 'ok') {
      Object.assign(o, { emp: r.emp, tax: r.tax, er: r.er, net: r.net, yEmp: r.yEmp, yTax: r.yTax, yEr: r.yEr, total: r.total, yTotal: r.yTotal,
        funds: r.funds, capped: r.r.capped, year: r.year, periods: r.periods.map(p => ({ months: p.months, emp: p.emp, tax: p.tax, er: p.er, net: p.net })),
        text: String(m.resultMarkup(r, {}, env)).replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ') });
    } else o.text = String(m.resultMarkup(r, {}, env)).replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ');
    return o;
  });
}`;
export const INDIRECT_JS = `async () => {
      const { indirectTaxes } = await import('./js/calc.js');
      const { getEnv, compute, resetMem, applyReferencePrices } = await import('./js/pages/s18-danaci.js');
      const a = await (await fetch('./data/indirect-tax-parameters.json')).json();
      const base = { vat20Eur: 120, vat9Eur: 109, vat0Eur: 50, fuelType: 'petrol', fuelLitres: 10, fuelPrice: 2,
        tobaccoPacks: 1, tobaccoPrice: 3, sticksPerPack: 20, date: '2027-02-28' };
      const cases = [{}, { fuelType: 'diesel' }, { tobaccoPrice: 10 }, { date: '2027-03-01' },
        { date: '2027-03-01', tobaccoPrice: 10 }, { fuelPrice: null }, { fuelLitres: null },
        { tobaccoPrice: null }, { tobaccoPacks: null }, { vat20Eur: 0, vat9Eur: 0, vat0Eur: 0, fuelLitres: 0, tobaccoPacks: 0 }];
      const rows = cases.map(c => indirectTaxes({...base, ...c}, a));
      const rates = await (await fetch('./data/rates.json')).json();
      const core = await (await fetch('./data/core.json')).json();
      const state = { gross: '1500', ind: true, purchases: '120', reduced: '109', exempt: '50', fuel: '10', fuelPrice: '2',
        tobacco: '1', tobaccoPrice: '3', sticks: '20', date: '2027-02-28', fuelType: 'petrol' };
      const views = [false,true].map(real => compute(state, getEnv({data:{rates,core,'indirect-tax-parameters':a},core,store:{get:k=>k==='onlyReal'&&real},period:{}})).ind);
      const env = getEnv({data:{rates,core,'indirect-tax-parameters':a},core,store:{get:()=>false},period:{}});
      const errors = ['purchases','reduced','exempt','fuel','tobacco','fuelPrice','tobaccoPrice','sticks'].map(key => {
        const c = compute({...state,[key]:'-1'},env); return {key,error:c.errors[key],status:c.ind.status,total:c.ind.total};
      });
      const dateCases = ['', '2027-02-30', '2026-07-31'].map(date => {
        const c=compute({...state,date},env);return {status:c.ind.status,error:c.errors.date,total:c.ind.total};
      });
      const blank=compute({...state,reduced:''},env);
      const fractional=compute({...state,sticks:'1,5'},env);
      const zeroPrice=compute({...state,fuelPrice:'0'},env);
      const unknownFuel=compute({...state,fuelType:'lpg'},env);
      const decimalPrices=compute({...state,fuelPrice:'1.605',tobaccoPrice:'3.512'},env).ind.inp;
      const reference = resetMem(); applyReferencePrices(reference,a);
      Object.assign(reference,{...state,fuelPrice:reference.fuelPrice,tobaccoPrice:reference.tobaccoPrice});
      const before=compute(reference,env).ind.inp;
      const shown=[reference.fuelPrice,reference.tobaccoPrice];
      const edited=compute({...reference,fuelPriceEdited:true,tobaccoPriceEdited:true},env).ind.inp;
      reference.fuelType='diesel';applyReferencePrices(reference,a);
      const diesel=compute(reference,env).ind.inp;
      return { untaxed:a.vat.untaxed, hasExtractedZero:Object.hasOwn(a.vat,'zeroPct'), rows, views, errors, dateCases, blank:{status:blank.ind.status,error:blank.errors.reduced}, fractional:fractional.errors.sticks,
        zeroPrice:zeroPrice.errors.fuelPrice, unknownFuel:unknownFuel.errors.fuelType, decimalPrices,
        references:{before,edited,shown,diesel,expected:[a.fuels.petrol.pricePerLitre,a.references.pack.priceEur,a.fuels.diesel.pricePerLitre]} };
    }`;
export type ComputeResult = {
  kind: string;
  err: string | null;
  text: string;
  emp: number;
  tax: number;
  er: number;
  net: number;
  yEmp: number;
  yTax: number;
  yEr: number;
  total: number;
  yTotal: number;
  funds: { you: number | null; boss: number | null; id: string }[];
  year: boolean;
  periods: { months: number }[];
  capped: boolean;
};
export type IndirectResult = {
  untaxed: { kind: string; basis: string };
  hasExtractedZero: boolean;
  rows: {
    fuelExcise: number | null;
    vat: number | null;
    tobaccoExcise: number | null;
    total: number | null;
  }[];
  views: ({ unavailable: boolean } | null)[];
  errors: { key: string; error: string | null; status: string; total: number | null }[];
  blank: { status: string; error: string | null };
  dateCases: { status: string; error: string | null; total: number | null }[];
  fractional: string | null;
  zeroPrice: string | null;
  unknownFuel: string | null;
  decimalPrices: { fuelPrice: number; tobaccoPrice: number };
  references: {
    before: { fuelPrice: number; tobaccoPrice: number };
    edited: { fuelPrice: number; tobaccoPrice: number };
    shown: string[];
    diesel: { fuelPrice: number };
    expected: number[];
  };
};
