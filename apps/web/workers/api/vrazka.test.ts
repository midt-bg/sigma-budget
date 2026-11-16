import { afterEach, describe, expect, it, vi } from 'vitest';
import { markdown, validateReport, vrazka, type Report } from './vrazka';
import { reportLimit, expireReports } from '../vrazka-window';
vi.mock('../release-data', () => ({ releaseData: async () => ({ releaseId: 'release-test' }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const good: Report = {
  type: 'error',
  text: 'Това е сигнал.',
  route: 'S10',
  value: '123 EUR',
  url: '/vedomstva?per=2027.draft',
  token: 'test',
};
const request = (body: unknown = good, headers = {}) =>
  new Request('https://site.test/api/vrazka', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://site.test',
      'CF-Connecting-IP': '192.0.2.1',
      ...headers,
    },
    body: JSON.stringify(body),
  });
function storage() {
  const values = new Map<string, unknown>();
  let alarm = 0;
  const tx = {
    get: async (key: string) => structuredClone(values.get(key)),
    put: async (key: string, value: unknown) => {
      values.set(key, structuredClone(value));
    },
    delete: async (key: string) => values.delete(key),
    setAlarm: async (time: number) => {
      alarm = time;
    },
  };
  return {
    values,
    alarm: () => alarm,
    transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  } as unknown as Pick<DurableObjectStorage, 'transaction'> & {
    values: Map<string, unknown>;
    alarm(): number;
  };
}
function environment() {
  const state = storage();
  const put = vi.fn(async () => ({}));
  const consume = vi.fn((key: string) => reportLimit(state, key, 1000));
  const env = {
    VRAZKA_BUCKET: { put },
    VRAZKA_IP_KEY: 'unit-test-key',
    TURNSTILE_SECRET_KEY: 'test-secret',
    VRAZKA_LIMITER: { getByName: () => ({ consume }) },
  } as unknown as Env;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true, hostname: 'site.test' })),
  );
  return { env, put, consume, state };
}
describe('report validation', () => {
  it('accepts context, optional contact and original whitespace in text', () => {
    expect(
      validateReport({
        ...good,
        text: '  hello\r\nworld  ',
        contact: 'reply@example.org',
        term: 'КФП',
      }),
    ).toMatchObject({ text: '  hello\r\nworld  ' });
  });
  it.each([
    null,
    [],
    {},
    { ...good, type: 'other' },
    { ...good, type: ['error'] },
    { ...good, text: '    a  ' },
    { ...good, text: 'x'.repeat(1001) },
    { ...good, extra: '' },
    { ...good, contact: 'bad' },
    { ...good, contact: 'a'.repeat(255) },
    { ...good, contact: 1 },
    { ...good, url: '//other.test/a' },
    { ...good, url: 'https://site.test/' },
    { ...good, url: '/\\other.test' },
    { ...good, url: '/a#b' },
    { ...good, token: 1 },
    { ...good, website: [] },
  ])('rejects invalid input %#', (bad) => expect(validateReport(bad)).toBeNull());
  it.each(['route', 'block', 'value', 'source', 'url', 'term'])(
    'rejects multiline, control, long and nonstring %s',
    (field) => {
      for (const value of ['a\nb', 'a\rb', '\u0000', 'x'.repeat(301), 123])
        expect(validateReport({ ...good, [field]: value })).toBeNull();
    },
  );
});
it('serializes every string as a JSON literal, with an untouched body', () => {
  const injection = '---\n"quoted"\r\n: ! & * # [ ] { }';
  const report = Object.fromEntries(
    ['type', 'route', 'block', 'value', 'source', 'url', 'term', 'contact', 'text'].map((field) => [
      field,
      injection,
    ]),
  ) as unknown as Report;
  const file = markdown(report, 'id', 'now', 'release');
  const end = file.indexOf('\n---\n\n');
  expect(file.slice(end + 6)).toBe(injection);
  for (const line of file.slice(4, end).split('\n').slice(1)) {
    const [field, ...value] = line.split(': ');
    expect(JSON.parse(value.join(': '))).toBe(
      ['id', 'received', 'release'].includes(field)
        ? { id: 'id', received: 'now', release: 'release' }[field]
        : injection,
    );
  }
});
it('checks method, media type and origin before touching the body', async () => {
  const { env } = environment();
  expect((await vrazka(new Request('https://site.test/api/vrazka'), env)).status).toBe(405);
  expect((await vrazka(request(good, { 'Content-Type': 'text/plain' }), env)).status).toBe(415);
  expect((await vrazka(request(good, { Origin: 'https://other.test' }), env)).status).toBe(403);
});
it('rejects a declared oversized body without reading it', async () => {
  const { env, put } = environment();
  const req = request(good, { 'Content-Length': '8193' });
  const read = vi.spyOn(req.body!, 'getReader');
  expect((await vrazka(req, env)).status).toBe(413);
  expect(read).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});
it.each([{}, { 'Content-Length': '10' }])(
  'caps streamed bytes despite headers %j',
  async (headers) => {
    const { env } = environment();
    expect((await vrazka(request({ ...good, text: 'x'.repeat(9000) }, headers), env)).status).toBe(
      413,
    );
  },
);
it('rejects malformed JSON and invalid reports before the honeypot', async () => {
  const { env } = environment();
  expect((await vrazka(new Request(request(), { body: '{' }), env)).status).toBe(400);
  expect((await vrazka(request({ ...good, text: '', website: 'bot' }), env)).status).toBe(400);
});
it('gives a honeypot receipt without Turnstile, counting or storing', async () => {
  const { env, put, consume } = environment();
  const res = await vrazka(request({ ...good, website: 'bot', token: '' }), env);
  expect(res.status).toBe(201);
  expect(await res.json()).toHaveProperty('id');
  expect(fetch).not.toHaveBeenCalled();
  expect(consume).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});
it.each(['VRAZKA_BUCKET', 'VRAZKA_IP_KEY', 'TURNSTILE_SECRET_KEY', 'VRAZKA_LIMITER'] as const)(
  'fails closed without %s',
  async (binding) => {
    const { env, put } = environment();
    delete env[binding];
    expect((await vrazka(request(), env)).status).toBe(503);
    expect(put).not.toHaveBeenCalled();
  },
);
it('requires successful Turnstile before counting or writing', async () => {
  const { env, put, consume } = environment();
  expect((await vrazka(request({ ...good, token: '' }), env)).status).toBe(400);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: false })),
  );
  expect((await vrazka(request(), env)).status).toBe(403);
  expect(consume).not.toHaveBeenCalled();
  expect(put).not.toHaveBeenCalled();
});
it('stores a private Markdown receipt and the block value, never IP or token', async () => {
  const { env, put, consume } = environment();
  const res = await vrazka(request(), env);
  const { id } = (await res.json()) as { id: string };
  expect(res.status).toBe(201);
  const [key, body, options] = put.mock.calls[0] as unknown as [string, string, object];
  expect(key).toMatch(new RegExp(`^signali/\\d{4}/\\d{2}/\\d{8}T\\d{6}Z-${id}.md$`));
  expect(body).toContain('value: "123 EUR"');
  expect(body).toContain('release: "release-test"');
  expect(body).not.toContain('192.0.2.1');
  expect(body).not.toContain('token:');
  expect(options).toEqual({
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
    customMetadata: { type: 'error', route: 'S10' },
  });
  expect(consume.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
  expect(body).not.toContain(consume.mock.calls[0][0]);
  expect(
    new URLSearchParams(vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams).get('remoteip'),
  ).toBe('192.0.2.1');
});
it('rejects the 11th report from the same IP', async () => {
  const { env, put } = environment();
  for (let i = 0; i < 10; i++) expect((await vrazka(request(), env)).status).toBe(201);
  expect((await vrazka(request(), env)).status).toBe(429);
  expect(put).toHaveBeenCalledTimes(10);
});
it('rejects the 101st overall report', async () => {
  const { env, put } = environment();
  for (let i = 0; i < 100; i++)
    expect((await vrazka(request(good, { 'CF-Connecting-IP': `192.0.2.${i}` }), env)).status).toBe(
      201,
    );
  expect((await vrazka(request(good, { 'CF-Connecting-IP': '192.0.2.200' }), env)).status).toBe(
    429,
  );
  expect(put).toHaveBeenCalledTimes(100);
});
it('expires all stored client keys at the hour, also without another request', async () => {
  const state = storage();
  for (let i = 0; i < 10; i++) expect(await reportLimit(state, 'hash', 1000)).toBe(true);
  expect(await reportLimit(state, 'hash', 2000)).toBe(false);
  await expireReports(state, 2000);
  expect(state.values.size).toBe(1);
  expect(state.alarm()).toBe(3600000);
  await expireReports(state, 3600000);
  expect(state.values.size).toBe(0);
  expect(await reportLimit(state, 'hash', 3600000)).toBe(true);
  expect(await reportLimit(state, 'hash', 7200000)).toBe(true);
});
it('fails closed on verification, limiter and bucket errors', async () => {
  const { env, put, consume } = environment();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 500 })),
  );
  expect((await vrazka(request(), env)).status).toBe(503);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true, hostname: 'site.test' })),
  );
  consume.mockRejectedValueOnce(new Error('unavailable'));
  expect((await vrazka(request(), env)).status).toBe(503);
  put.mockRejectedValueOnce(new Error('unavailable'));
  expect((await vrazka(request(), env)).status).toBe(503);
});

it('checks Origin against the request host without changing canonical origin configuration', async () => {
  const { env } = environment();
  env.SITE_ORIGIN = 'https://canonical.test';
  expect((await vrazka(request(), env)).status).toBe(201);
  expect((await vrazka(request(good, { Origin: 'https://canonical.test' }), env)).status).toBe(403);
});
it.each([undefined, 'other.test'])(
  'rejects a successful token for hostname %s before counting or writing',
  async (hostname) => {
    const { env, put, consume } = environment();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: true, hostname })),
    );
    expect((await vrazka(request(), env)).status).toBe(403);
    expect(consume).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  },
);
it('skips hostname matching only with the documented Turnstile test secret', async () => {
  const { env } = environment();
  env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true, hostname: 'example.com' })),
  );
  expect((await vrazka(request(), env)).status).toBe(201);
});
it('returns 503 without counting or writing when siteverify times out after five seconds', async () => {
  const { env, put, consume } = environment();
  // AbortSignal.timeout uses the platform clock; capture the requested deadline without waiting five seconds.
  let abort!: () => void;
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => controller.signal);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          abort = () => controller.abort(new DOMException('Timed out', 'TimeoutError'));
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
        }),
    ),
  );
  try {
    const pending = vrazka(request(), env);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(timeout).toHaveBeenCalledWith(5000);
    abort();
    expect((await pending).status).toBe(503);
    expect(consume).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  } finally {
    timeout.mockRestore();
  }
});
