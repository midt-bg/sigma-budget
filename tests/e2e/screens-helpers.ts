import { readFile } from 'node:fs/promises';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { test as base, expect } from './fixtures.ts';
import { ROUTES, type WebRoute } from '../../apps/web/app/lib/routes.ts';
import {
  INIT_JS,
  SETTLE_JS,
  DEEP_JS,
  CLEAR_JS,
  DIAG_JS,
  DISCOVER_JS,
  AUDIT_JS,
  AXE_JS,
} from './screens-scripts.ts';

export const CELLS = {
  '1280-light': { viewport: { width: 1280, height: 900 }, colorScheme: 'light', hasTouch: false },
  '400-light': { viewport: { width: 400, height: 800 }, colorScheme: 'light', hasTouch: true },
} as const;
export type Cell = keyof typeof CELLS;
export const cells = Object.keys(CELLS) as Cell[];
export const routes = ROUTES.filter((r) => !r.retired).map((r) => ({
  ...r,
  samples: r.samples.length ? r.samples : [r.pattern ? '#' + r.pattern : '#/nyama-takava'],
}));
export const withQuery = (h: string, q: Record<string, string>) =>
  h +
  (h.includes('?') ? '&' : '?') +
  Object.entries(q)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
export const prefBlob = (values: Record<string, unknown>) => ({
  'bns.prefs.v1': JSON.stringify(values),
});
export const pickCell = (index: number) => cells[index % cells.length]!;
export interface Finding {
  level: 'fail' | 'warn';
  code: string;
  msg: string;
}
export interface Audit {
  problems: { c: string; l: 'fail' | 'warn'; m: string }[];
  info: { route: string; view: string; [key: string]: unknown };
}
export interface Discovery {
  routes: WebRoute[];
  periods: string[];
  users: string[];
  defaultPeriod: string;
}
export const problemFindings = (audit: Audit): Finding[] =>
  audit.problems.map((p) => ({ level: p.l, code: p.c, msg: p.m }));
export function report(findings: Finding[], label: string) {
  const warnings = findings.filter((f) => f.level === 'warn');
  if (warnings.length)
    base.info().annotations.push({
      type: 'screen warnings',
      description: label + ': ' + JSON.stringify(warnings),
    });
  expect
    .soft(
      findings.filter((f) => f.level === 'fail'),
      label,
    )
    .toEqual([]);
}
/** Same per-page event collection and classifications as Probe in screens.py. */
export class Probe {
  items: Finding[] = [];
  urls: string[] = [];
  constructor(page: Page, origin: string) {
    const add = (level: Finding['level'], code: string, msg: string) =>
      this.items.push({ level, code, msg });
    page.on('console', (m) => {
      if (!['error', 'warning'].includes(m.type())) return;
      const text = m.text();
      if (
        [
          /Service Worker|serviceWorker/i,
          /^Failed to load resource/i,
          /preloaded using link preload but not used/i,
        ].some((rx) => rx.test(text))
      )
        return;
      const loc = m.location();
      const where = loc.url ? ` (${loc.url.replace(origin, '')}:${loc.lineNumber})` : '';
      add(
        m.type() === 'error' ? 'fail' : 'warn',
        m.type() === 'error' ? 'console' : 'console-warn',
        text.slice(0, 400) + where,
      );
    });
    page.on('pageerror', (e) =>
      add(
        'fail',
        'exception',
        (e.stack || String(e)).trim().split('\n').slice(0, 3).join(' | ').slice(0, 500),
      ),
    );
    page.on('response', (r) => {
      this.urls.push(r.url());
      if (r.status() < 400) return;
      const path = r.url().replace(origin, '');
      if (r.url().startsWith(origin) && path.startsWith('/data/'))
        add('warn', 'pending-data', `${path} -> ${r.status()} (data file not there yet)`);
      else add('fail', `http-${r.status()}`, `${path || r.url()} -> ${r.status()}`);
    });
    page.on('request', (r) => {
      const u = r.url();
      if (/^(data:|blob:|about:)/.test(u)) return;
      if (!u.startsWith(origin) && /^(https?|wss?|ftp):\/\//.test(u))
        add('fail', 'external', `request to another origin: ${u.slice(0, 160)}`);
    });
    page.on('requestfailed', (r) => {
      const error = r.failure()?.errorText || '';
      if (!error.includes('ERR_ABORTED'))
        add(
          'fail',
          'request-failed',
          `${r.url().replace(origin, '').slice(0, 160)}: ${error.slice(0, 80)}`,
        );
    });
    page.on('dialog', async (d) => {
      add('fail', 'dialog', `${d.type()}() dialog: ${d.message().slice(0, 80)}`);
      await d.dismiss().catch(() => {});
    });
    page.on('crash', () => add('fail', 'crash', 'the page crashed'));
  }
  reset() {
    this.items = [];
    this.urls = [];
  }
  drain() {
    const out = this.items;
    this.items = [];
    return out;
  }
}
export interface Opened {
  page: Page;
  ctx: BrowserContext;
  probe: Probe;
  ok: boolean;
  why: string;
}
export async function collect(o: Opened): Promise<Finding[]> {
  const fs = o.probe.drain();
  const cookies = await o.ctx.cookies();
  if (cookies.length)
    fs.push({
      level: 'fail',
      code: 'cookie',
      msg:
        'the site set cookie(s): ' +
        cookies
          .map((c) => c.name)
          .join(', ')
          .slice(0, 120),
    });
  return fs;
}
/** A context/page per cell+options, reused only inside a test; every open clears storage and cookies. */
export class Screens {
  private readonly contexts = new Map<string, { ctx: BrowserContext; page: Page; probe: Probe }>();
  readonly timeout = 15000;
  readonly browser: Browser;
  readonly baseURL: string;
  constructor(browser: Browser, baseURL: string) {
    this.browser = browser;
    this.baseURL = baseURL;
  }
  async cell(
    name: Cell,
    extra: {
      w?: number;
      h?: number;
      sw?: 'allow' | 'block';
      motion?: boolean;
      reducedMotion?: boolean;
    } = {},
  ) {
    const key = name + JSON.stringify(extra);
    const old = this.contexts.get(key);
    if (old) return old;
    const c = CELLS[name];
    const ctx = await this.browser.newContext({
      ...c,
      viewport: { width: extra.w ?? c.viewport.width, height: extra.h ?? c.viewport.height },
      locale: 'bg-BG',
      timezoneId: 'Europe/Sofia',
      serviceWorkers: extra.sw ?? 'block',
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write'],
      reducedMotion: extra.reducedMotion || !extra.motion ? 'reduce' : 'no-preference',
    });
    await ctx.addInitScript(INIT_JS);
    const page = await ctx.newPage();
    page.setDefaultTimeout(this.timeout);
    page.setDefaultNavigationTimeout(this.timeout + 5000);
    const state = { ctx, page, probe: new Probe(page, new URL(this.baseURL).origin) };
    this.contexts.set(key, state);
    return state;
  }
  async ready(page: Page, shouldSettle = true): Promise<{ ok: boolean; why: string }> {
    try {
      await page.waitForSelector('article.page[data-ready="1"]', { state: 'attached' });
      if (shouldSettle) {
        await page.waitForFunction(SETTLE_JS);
        await page.waitForTimeout(120);
      }
      return { ok: true, why: '' };
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
      const diag = await evaluate(page, DIAG_JS).catch((e) => `(no diagnostics: ${e})`);
      return {
        ok: false,
        why: `the screen did not become ready within ${this.timeout} ms - ${diag}`,
      };
    }
  }
  async open(
    name: Cell,
    hash = '#/',
    prefs: Record<string, string> = {},
    extra: Parameters<Screens['cell']>[1] = {},
  ): Promise<Opened> {
    const state = await this.cell(name, extra);
    await state.page.goto(this.baseURL + '/robots.txt', { waitUntil: 'commit' }).catch(() => {});
    await evaluate(state.page, CLEAR_JS, prefs);
    await state.ctx.clearCookies();
    state.probe.reset();
    await state.page.goto(this.baseURL + '/' + hash, { waitUntil: 'domcontentloaded' });
    return { ...state, ...(await this.ready(state.page)) };
  }
  async close() {
    for (const { ctx } of this.contexts.values()) await ctx.close();
  }
}
export async function settle(page: Page, ms = 150) {
  await page.waitForFunction(SETTLE_JS);
  await page.waitForTimeout(ms);
}
export async function deepPass(page: Page) {
  await evaluate(page, DEEP_JS);
  await settle(page);
}
export const audit = (page: Page, route: string, deep = false) =>
  evaluate<Audit>(page, AUDIT_JS, { expect: route, deep });
export function mergeAudits(a: Audit, b: Audit): Audit {
  const seen = new Set<string>();
  const problems = [...b.problems, ...a.problems].filter((p) => {
    const k = JSON.stringify([p.c, p.m]);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const info = { ...b.info };
  for (const k of ['links', 'ext', 'rel'])
    info[k] = [
      ...new Set([...((a.info[k] as string[]) || []), ...((b.info[k] as string[]) || [])]),
    ].sort();
  const shares = (info.share || []) as { id: string }[];
  info.share = [
    ...shares,
    ...((a.info.share || []) as { id: string }[]).filter((s) => !shares.some((t) => t.id === s.id)),
  ];
  return { problems, info };
}
// These bounded RAF waits retain the original polling mode and failure-as-a-finding contract.
export async function waitFor(page: Page, js: string, arg: unknown = null, timeout = 2500) {
  try {
    await page.waitForFunction(js, arg, { timeout });
    return true;
  } catch {
    return false;
  }
}
export const present = (page: Page, sel: string) =>
  evaluate(page, '(s) => !!document.querySelector(s)', sel);
export const isActive = (page: Page, sel: string) =>
  evaluate(page, '(s) => !!document.activeElement && document.activeElement.matches(s)', sel);
export const waitGone = (page: Page, sel: string, timeout = 2500) =>
  waitFor(page, '(s) => !document.querySelector(s)', sel, timeout);
export const waitThere = (page: Page, sel: string, timeout = 2500) =>
  waitFor(
    page,
    '(s) => { const e = document.querySelector(s); return !!e && e.getBoundingClientRect().height > 0; }',
    sel,
    timeout,
  );
export const test = base.extend<{ screens: Screens }, { discovery: Discovery }>({
  screens: async ({ browser, siteURL }, use) => {
    const screens = new Screens(browser, siteURL);
    try {
      await use(screens);
    } finally {
      await screens.close();
    }
  },
  discovery: [
    async ({ browser, siteURL }, use) => {
      const screens = new Screens(browser, siteURL);
      try {
        const o = await screens.open('1280-light');
        expect(o.ok, o.why).toBe(true);
        // Discovery originally drains events, without the cookie check.
        expect(
          o.probe.drain().filter((f) => f.level === 'fail'),
          'discovery events',
        ).toEqual([]);
        const d = await evaluate<Discovery>(o.page, DISCOVER_JS);
        expect(d.routes?.length, 'window.__ROUTES__ is missing or empty').toBeTruthy();
        expect(
          d.routes.map((r) => ({
            ...r,
            samples: r.samples.length
              ? r.samples
              : [r.pattern ? '#' + r.pattern : '#/nyama-takava'],
          })),
          'built route catalogue equals test catalogue',
        ).toEqual(
          routes.map(
            ({
              file: _file,
              icon: _icon,
              desc: _desc,
              short: _short,
              query: _query,
              retired: _retired,
              ...r
            }) => ({ ...r, bare: !!r.bare }),
          ),
        );
        await use(d);
      } finally {
        await screens.close();
      }
    },
    { scope: 'worker' },
  ],
});
export { expect };

/** Python evaluates function strings by invoking them; JS Playwright requires an expression invocation. */
export function evaluate<T = unknown>(page: Page, program: string, arg?: unknown): Promise<T> {
  return page.evaluate<T>(`(${program})(${JSON.stringify(arg) ?? 'undefined'})`);
}

/** Keep independent cases running after a checker exception, as the Python job registry did. */
export async function screenStep(title: string, run: () => Promise<void>) {
  await base.step(title, async () => {
    try {
      await run();
    } catch (error) {
      report([{ level: 'fail', code: 'checker-error', msg: String(error) }], title);
    }
  });
}
/** Optional equivalent of screens.py --axe FILE|URL, outside the default CI case count. */
export async function axeFindings(page: Page): Promise<Finding[]> {
  const spec = process.env.E2E_SCREENS_AXE;
  if (!spec) return [];
  if (!(await evaluate(page, '() => !!window.axe'))) {
    const source = /^https?:\/\//.test(spec)
      ? await (await fetch(spec, { signal: AbortSignal.timeout(30000) })).text()
      : await readFile(spec, 'utf8');
    await page.evaluate(source);
  }
  const violations = await evaluate<
    { id: string; impact: string; help: string; n: number; t: string[] }[]
  >(page, AXE_JS);
  return violations.map((v) => ({
    level: 'fail',
    code: 'axe',
    msg: `${v.id} (${v.impact}): ${v.help} - ${v.n} node(s), e.g. ${v.t.join('; ')}`,
  }));
}
