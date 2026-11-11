import { expect, it, vi } from 'vitest';
vi.mock('react-router', () => ({ createRequestHandler: () => async () => new Response('page') }));
vi.mock('./release-data', () => ({
  usesRegistry: vi.fn(async () => false),
  releaseData: vi.fn(async () => ({
    releaseId: 'test',
    dataBase: '/data/',
    load: async () => null,
    file: async () => null,
  })),
  candidateReleaseId: () => null,
  noRegistry: () => false,
}));
import app from './app';
import { usesRegistry, releaseData } from './release-data';

it('finalizes actual dispatch early returns, resource fallbacks, admin auth and exceptions', async () => {
  const ctx = { waitUntil: vi.fn() } as unknown as ExecutionContext;
  const env = {
    ENVIRONMENT: 'local',
    ASSETS: { fetch: async () => new Response('asset') },
  } as unknown as Env;
  for (const [path, method, status] of [
    ['/', 'POST', 405],
    ['/admin/operations', 'GET', 503],
    ['/api/releases', 'GET', 503],
    ['/api/releases/%ZZ', 'GET', 400],
    ['/data/core.json', 'GET', 200],
    ['/missing', 'GET', 200],
  ] as const) {
    const res = await app.fetch(new Request('https://budget.example' + path, { method }), env, ctx);
    expect(res.status, path).toBe(status);
    expect(res.headers.get('X-Robots-Tag'), path).toBe('noindex');
    expect(res.headers.get('X-Content-Type-Options'), path).toBe('nosniff');
    expect(res.headers.has('Content-Security-Policy'), path).toBe(true);
  }
  const failure = await app.fetch(
    new Request('https://budget.example/data/core.json'),
    {
      ...env,
      ASSETS: {
        fetch: async () => {
          throw new Error('private details');
        },
      },
    } as unknown as Env,
    ctx,
  );
  expect(failure.status).toBe(503);
  expect(failure.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(await failure.text()).not.toContain('private details');
});

it('rate-limits the actual public API before D1 or R2 reads', async () => {
  const prepare = vi.fn();
  const env = {
    ENVIRONMENT: 'production',
    DB: { prepare },
    OBJECTS: {},
    RELEASE_RATE_LIMITER: { limit: async () => ({ success: false }) },
  } as unknown as Env;
  const res = await app.fetch(
    new Request('https://budget.example/api/releases'),
    env,
    {} as ExecutionContext,
  );
  expect(res.status).toBe(429);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(prepare).not.toHaveBeenCalled();
});

it('does not charge bundled static files to the registry read limiter', async () => {
  const limit = vi.fn(async () => ({ success: false }));
  const env = {
    ENVIRONMENT: 'production',
    ASSETS: { fetch: async () => new Response('bundled') },
    RELEASE_RATE_LIMITER: { limit },
  } as unknown as Env;
  const res = await app.fetch(
    new Request('https://budget.example/data/core.json'),
    env,
    {} as ExecutionContext,
  );
  expect(res.status).toBe(200);
  expect(await res.text()).toBe('bundled');
  expect(limit).not.toHaveBeenCalled();
});

it('limits stable registry data before loading the manifest or file', async () => {
  vi.mocked(usesRegistry).mockResolvedValueOnce(true);
  vi.mocked(releaseData).mockClear();
  const env = {
    ENVIRONMENT: 'production',
    RELEASE_RATE_LIMITER: { limit: async () => ({ success: false }) },
  } as unknown as Env;
  const res = await app.fetch(
    new Request('https://budget.example/data/core.json'),
    env,
    {} as ExecutionContext,
  );
  expect(res.status).toBe(429);
  expect(releaseData).not.toHaveBeenCalled();
});
