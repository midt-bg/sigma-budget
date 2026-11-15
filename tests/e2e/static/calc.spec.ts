import { test, expect } from '../fixtures.ts';
import {
  calculatorResults,
  indirectTaxResults,
  type ComputeResult,
  type IndirectResult,
} from '../calc-probes.ts';
import { salaryModel, insurableIncomeCaps } from '../expected.ts';
test.use({ serviceWorkers: 'block', reducedMotion: 'reduce' });

test('salary engine and indirect tax cases', async ({ context, page, siteURL }) => {
  await context.addInitScript(() => {
    window.__HASH_ROUTES__ = true;
  });
  await page.goto(siteURL + '/index.html#/danaci');
  await page.waitForSelector('#s18-view', { timeout: 8000 });
  const ref = [
    ['1500', 'from'],
    ['1500', 'until'],
    ['1500', 'year'],
  ];
  const low = [
    ['500', 'from'],
    ['1000', 'until'],
    ['1000.5', 'from'],
    ['2000', 'year'],
  ];
  const edge = [
    ['2111.64', 'until'],
    ['2111.65', 'until'],
    ['2300', 'from'],
    ['2300.01', 'from'],
    ['2200', 'until'],
    ['2200', 'from'],
    ['2111.64', 'year'],
    ['2300', 'year'],
  ];
  const high = [
    ['3000', 'until'],
    ['3000', 'from'],
    ['3000', 'year'],
    ['5000', 'from'],
    ['12345.67', 'year'],
    ['100000', 'from'],
  ];
  const odd = [
    ['1234.56', 'from'],
    ['1234.56', 'until'],
    ['1234.56', 'year'],
    ['999.99', 'year'],
    ['777.77', 'from'],
    ['1111.11', 'until'],
    ['2222.22', 'year'],
    ['0.01', 'from'],
  ];
  type Case = { gross: string; rules: string; tzpb?: number };
  const cases: Case[] = [...ref, ...low, ...edge, ...high, ...odd].map(([gross, rules]) => ({
    gross: gross!,
    rules: rules!,
  }));
  for (const tzpb of [0.4, 0.7, 1.1, 2.0, 0.1])
    for (const rules of ['from', 'year']) cases.push({ gross: '1800', rules, tzpb });
  // The result is JSON from the browser probe, not a shared production type/model.
  const results = await page.evaluate(calculatorResults, cases);
  for (const [i, c] of cases.entries()) {
    const o = results[i]!,
      tag = JSON.stringify(c);
    expect.soft(o.kind, tag).toBe('ok');
    if (o.kind !== 'ok') continue;
    const m = salaryModel(c.gross, c.rules, c.tzpb);
    for (const k of ['emp', 'tax', 'er', 'net', 'yEmp', 'yTax', 'yEr'] as const)
      expect.soft(Math.abs(o[k] - m[k]), `${tag}: ${k}`).toBeLessThanOrEqual(0.005);
    expect
      .soft(Math.abs(o.net + o.emp + o.tax - Number(c.gross)), tag + ': gross sum')
      .toBeLessThan(0.005);
    expect.soft(Math.abs(o.total - o.emp - o.tax - o.er), tag + ': total').toBeLessThan(0.005);
    expect
      .soft(Math.abs(o.yTotal - o.yEmp - o.yTax - o.yEr), tag + ': annual total')
      .toBeLessThan(0.005);
    expect.soft(Boolean(o.funds?.length), tag + ': fund split').toBe(true);
    if (o.funds?.length) {
      expect
        .soft(
          Math.abs(
            o.funds.reduce((s: number, x: { you: number | null }) => s + (x.you || 0), 0) - o.emp,
          ),
          tag + ': personal funds',
        )
        .toBeLessThan(0.005);
      expect
        .soft(
          Math.abs(
            o.funds.reduce((s: number, x: { boss: number | null }) => s + (x.boss || 0), 0) - o.er,
          ),
          tag + ': employer funds',
        )
        .toBeLessThan(0.005);
      expect
        .soft(
          o.funds.every(
            (x: { id: string; you: number | null }) => x.you === null || x.id !== 'tzpb',
          ),
          tag + ': no personal ТЗПБ',
        )
        .toBe(true);
    }
    if (c.rules === 'year') {
      expect.soft(o.year, tag + ': year').toBeTruthy();
      expect
        .soft(
          o.periods.map((p: { months: number }) => p.months),
          tag + ': periods',
        )
        .toEqual([7, 5]);
    } else
      expect.soft(o.capped, tag + ': cap').toBe(Number(c.gross) > insurableIncomeCaps[c.rules]!);
    expect.soft(o.text, tag).not.toMatch(/NaN|undefined/);
  }
  const r = results[0]!;
  expect
    .soft([r.net, r.emp, r.tax, r.er], 'reference 1500')
    .toEqual([1163.97, 206.7, 129.33, 283.8]);
  for (const s of ['1 163,97', '206,70', '129,33', '283,80'])
    expect.soft(r.text.replace(/[  ]/g, ' ')).toContain(s);
  const run = (cases: Case[]) => page.evaluate(calculatorResults, cases);
  const a = await run([0.4, 1.1].map((tzpb) => ({ gross: '1800', rules: 'from', tzpb })));
  for (const k of ['net', 'emp', 'tax'] as const)
    expect.soft(a[0]![k], 'ТЗПБ personal ' + k).toBe(a[1]![k]);
  expect.soft(a[1]!.er).toBeGreaterThan(a[0]!.er);
  const b = await run(
    ['until', 'from'].flatMap((rules) => ['3000', '9000'].map((gross) => ({ gross, rules }))),
  );
  for (const i of [0, 2])
    for (const k of ['emp', 'er'] as const)
      expect.soft(b[i]![k], `${i}: above cap ${k}`).toBe(b[i + 1]![k]);
  expect.soft(b[0]!.emp).toBeLessThan(b[2]!.emp);
  const boundary = await run(
    ['2000', '2200'].flatMap((gross) => ['until', 'from'].map((rules) => ({ gross, rules }))),
  );
  expect.soft(boundary[0]!.emp).toBe(boundary[1]!.emp);
  expect.soft(boundary[3]!.emp).toBeGreaterThan(boundary[2]!.emp);
  const y = await run(['until', 'from', 'year'].map((rules) => ({ gross: '2200', rules })));
  for (const [annual, monthly] of [
    ['yEmp', 'emp'],
    ['yTax', 'tax'],
    ['yEr', 'er'],
  ] as const)
    expect
      .soft(Math.abs(y[2]![annual] - (y[0]![monthly] * 7 + y[1]![monthly] * 5)), annual + ': 7+5')
      .toBeLessThan(0.005);
  const bad = ['', '0', '-5', 'abc', '1e3x', '0,00', '10000001', '  '];
  const invalid = await run(bad.map((gross) => ({ gross, rules: 'from' })));
  for (const [i, gross] of bad.entries()) {
    expect.soft(invalid[i]!.kind, JSON.stringify(gross)).toBe('empty');
    expect.soft(invalid[i]!.text, JSON.stringify(gross)).not.toMatch(/\d[\d\s ]*,\d\d/);
  }
  expect
    .soft(
      Boolean(invalid[1]!.err) && invalid[2]!.err != null && Boolean(invalid[3]!.err),
      'invalid errors',
    )
    .toBe(true);
  const spelled = await run(
    ['1 500,00', '1500.00', '1.500,00', '1,500.00', '1500 €'].map((gross) => ({
      gross,
      rules: 'from',
    })),
  );
  expect
    .soft(
      spelled.every((o: { kind: string; net: number }) => o.kind === 'ok' && o.net === 1163.97),
      'spelled amounts',
    )
    .toBe(true);

  const x = await page.evaluate(indirectTaxResults);
  const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-8;
  expect
    .soft(
      x.untaxed.kind === 'definition' && x.untaxed.basis.startsWith('ЗДДС'),
      'untaxed definition',
    )
    .toBe(true);
  expect.soft(x.hasExtractedZero).toBe(false);
  expect.soft(near(x.rows[0]!.fuelExcise, 3.6302), 'petrol coefficient').toBe(true);
  expect.soft(near(x.rows[1]!.fuelExcise, 3.3029), 'diesel coefficient').toBe(true);
  expect.soft(near(x.rows[0]!.vat, 20 + 9 + 20 / 6 + 3 / 6), 'gross VAT').toBe(true);
  for (const [i, want] of [
    [0, 2.4],
    [2, 3.64],
    [3, 2.52],
    [4, 3.69],
  ] as const)
    expect.soft(near(x.rows[i]!.tobaccoExcise, want), `dated tobacco ${i}`).toBe(true);
  for (const i of [5, 6, 7, 8]) expect.soft(x.rows[i]!.total, `missing ${i}`).toBeNull();
  expect.soft(x.rows[9]!.total).toBe(0);
  expect
    .soft(
      x.views.every((v: { unavailable: boolean } | null) => v && !v.unavailable),
      'only-real estimate',
    )
    .toBe(true);
  for (const row of x.errors)
    expect
      .soft(Boolean(row.error) && row.status === 'invalid' && row.total === null, row.key)
      .toBe(true);
  expect.soft(x.blank).toEqual({ status: 'missing', error: null });
  for (const [i, status] of ['missing', 'invalid', 'unsupported'].entries()) {
    expect.soft(x.dateCases[i]!.status).toBe(status);
    expect.soft(x.dateCases[i]!.total).toBeNull();
  }
  expect
    .soft(Boolean(x.dateCases[1]!.error) && Boolean(x.dateCases[2]!.error), 'date errors')
    .toBe(true);
  for (const key of ['fractional', 'zeroPrice', 'unknownFuel'] as const)
    expect.soft(Boolean(x[key]), key).toBe(true);
  expect
    .soft(
      near(x.decimalPrices.fuelPrice, 1.605) && near(x.decimalPrices.tobaccoPrice, 3.512),
      'decimal prices',
    )
    .toBe(true);
  const refs = x.references;
  expect.soft(refs.shown).toEqual(['1,605', '3,51']);
  expect
    .soft(
      near(refs.before.fuelPrice, refs.expected[0]!) &&
        near(refs.before.tobaccoPrice, refs.expected[1]!),
      'source precision',
    )
    .toBe(true);
  expect
    .soft(
      near(refs.edited.fuelPrice, 1.605) && near(refs.edited.tobaccoPrice, 3.51),
      'entered precision',
    )
    .toBe(true);
  expect.soft(near(refs.diesel.fuelPrice, refs.expected[2]!), 'diesel precision').toBe(true);
});

for (const w of [1280, 390])
  test(`calculator screen ${w}`, async ({ browser, siteURL }) => {
    const ctx = await browser.newContext({
      serviceWorkers: 'block',
      reducedMotion: 'reduce',
      hasTouch: w < 700,
      viewport: { width: w, height: w >= 700 ? 900 : 844 },
    });
    try {
      await ctx.addInitScript(() => {
        window.__HASH_ROUTES__ = true;
      });
      const page = await ctx.newPage(),
        errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 160));
      });
      page.on('pageerror', (e) => errors.push('EXC ' + String(e).slice(0, 160)));
      await page.goto(siteURL + '/index.html#/danaci');
      await page.waitForSelector('#s18-view', { timeout: 8000 });
      await page.waitForTimeout(500);
      const text = async (id: string) =>
        (await page.locator('#' + id).textContent())!.replace(/[    ]/g, ' ');
      const tx = () => text('s18-view');
      for (const s of ['1 163,97', '206,70', '129,33', '283,80', '336,03'])
        expect.soft(await tx()).toContain(s);
      expect.soft(await page.evaluate(() => location.hash)).toBe('#/danaci');
      await page.fill('#s18-gross', '2 345,67');
      await page.waitForTimeout(200);
      let h: string = await page.evaluate(() => location.href);
      expect
        .soft(
          !['2345', '2%20345', 'gross'].some((k) => h.includes(k)) &&
            !h.split('#')[1]!.includes('?'),
          'salary URL',
        )
        .toBe(true);
      const base = await tx();
      await page.check('#s18-rules-until', { force: true });
      await page.waitForTimeout(200);
      expect.soft(await tx(), 'period changes result').not.toBe(base);
      await page.check('#s18-rules-year', { force: true });
      await page.waitForTimeout(200);
      expect.soft(await tx()).toContain('средно на месец');
      expect.soft(await tx()).toContain('За цялата 2026');
      await page.check('#s18-rules-from', { force: true });
      await page.fill('#s18-gross', 'abc');
      await page.waitForTimeout(200);
      expect.soft(await tx()).not.toMatch(/\d,\d\d\s*€/);
      expect.soft(await page.locator('#s18-gross-err').count()).toBe(1);
      await page.fill('#s18-gross', '1500');
      await page.waitForTimeout(200);
      expect.soft(await tx()).toContain('1 163,97');
      for (const d of ['s18-funds', 's18-how', 's18-sources', 's18-receipt', 's18-indirect'])
        await page.evaluate((id) => {
          const d = document.querySelector<HTMLDetailsElement>('#' + id);
          if (d) d.open = true;
        }, d);
      await page.waitForTimeout(200);
      const funds = await text('s18-funds-view'),
        how = await text('s18-how-view');
      for (const s of ['ДОО', 'ТЗПБ', '6,00', '163,80']) expect.soft(funds).toContain(s);
      for (const s of ['1 500,00 € × 13,78%', '206,70', '283,80']) expect.soft(how).toContain(s);
      expect.soft(await page.isChecked('#s18-ind')).toBe(false);
      const main = await tx();
      await page.check('#s18-ind', { force: true });
      expect.soft(await page.inputValue('#s18-fuelPrice')).toBe('1,605');
      expect.soft(await page.inputValue('#s18-tobaccoPrice')).toBe('3,51');
      for (const [key, value] of [
        ['purchases', '120'],
        ['reduced', '109'],
        ['exempt', '0'],
        ['fuel', '0'],
        ['tobacco', '0'],
      ] as const)
        await page.fill('#s18-' + key, value);
      await page.waitForTimeout(250);
      expect.soft((await text('s18-ind-view')).toLowerCase()).toContain('ориентировъчно');
      expect.soft(await tx()).toBe(main);
      for (const key of [
        'purchases',
        'reduced',
        'exempt',
        'fuel',
        'tobacco',
        'fuelPrice',
        'tobaccoPrice',
        'sticks',
      ]) {
        const selector = '#s18-' + key,
          previous = await page.inputValue(selector);
        await page.fill(selector, '-1');
        expect.soft(await page.getAttribute(selector, 'aria-invalid'), key).toBe('true');
        expect.soft(await page.locator(selector + '-err').count(), key).toBe(1);
        expect.soft(await page.locator('#s18-ind-view').innerText(), key).toContain('Поправи');
        await page.fill(selector, previous);
        expect.soft(await page.getAttribute(selector, 'aria-invalid'), key).toBeNull();
      }
      await page.fill('#s18-reduced', '');
      expect.soft(await page.locator('#s18-ind-view').innerText()).toContain('Липсва');
      expect.soft(await page.getAttribute('#s18-reduced', 'aria-invalid')).toBeNull();
      await page.fill('#s18-reduced', '109');
      await page.fill('#s18-tobacco', '1');
      await page.fill('#s18-sticks', '20');
      await page.fill('#s18-date', '2026-07-31');
      expect.soft(await page.getAttribute('#s18-date', 'aria-invalid')).toBe('true');
      expect.soft(await page.locator('#s18-ind-view').innerText()).toContain('проверени ставки');
      await page.fill('#s18-date', '2026-11-08');
      await page.fill('#s18-tobacco', '0');
      await page.fill('#s18-sticks', '');
      h = await page.evaluate(() => location.href);
      expect.soft(h.split('#')[1]).not.toContain('?');
      expect
        .soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
      expect.soft(errors).toEqual([]);
    } finally {
      await ctx.close();
    }
  });
