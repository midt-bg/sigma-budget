import { createHash } from 'node:crypto';
import { canonicalJson } from '@sigma-budget/ingest/release-client';
import { expect, it, vi } from 'vitest';
vi.mock('react-router', () => ({ createRequestHandler: () => async () => new Response('page') }));
import app from './app';

it('serves only current manifest outputs with their exact published bytes and asset headers', async () => {
  const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const bytes = new TextEncoder().encode('{"value":42}\n');
  const validation = '{"passed":true}\n';
  const manifest = {
    manifest_schema: 'budget-release/1',
    data_schema: {},
    processing: { code: { commit: 'a'.repeat(40) } },
    inputs: [
      {
        path: 'data/originals/source.pdf',
        sha256: hash('original'),
        bytes: 8,
        mime: 'application/pdf',
      },
    ],
    outputs: [
      {
        path: 'data/core.json',
        sha256: hash(bytes),
        bytes: bytes.length,
        mime: 'application/json',
      },
      {
        path: 'validation.json',
        role: 'validation',
        sha256: hash(validation),
        bytes: validation.length,
        mime: 'application/json',
      },
    ],
  };
  const currentManifest = canonicalJson(manifest) + '\n';
  const oldManifest =
    canonicalJson({ ...manifest, processing: { code: { commit: 'b'.repeat(40) } } }) + '\n';
  const current = hash(currentManifest),
    old = hash(oldManifest);
  const cache = 'public, max-age=300, must-revalidate';
  const fetch = async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path === '/data/releases/current.json') return Response.json({ release_id: current });
    if (path === `/data/releases/${current}/manifest.json`) return new Response(currentManifest);
    if (path === `/data/releases/${old}/manifest.json`) return new Response(oldManifest);
    if (path === '/data/core.json')
      return new Response(bytes, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': cache,
          ETag: '"packaged-core"',
        },
      });
    if (path === '/data/originals/source.pdf') return new Response('original');
    return new Response(null, { status: 404 });
  };
  const env = { ENVIRONMENT: 'local', ASSETS: { fetch } } as unknown as Env;
  const visit = (path: string) =>
    app.fetch(new Request('https://budget.example' + path), env, {} as ExecutionContext);
  const output = await visit(`/data/releases/${current}/data/core.json`);
  expect(output.status).toBe(200);
  expect(hash(new Uint8Array(await output.arrayBuffer()))).toBe(manifest.outputs[0]!.sha256);
  expect(output.headers.get('ETag')).toBe('"packaged-core"');
  expect(output.headers.get('Cache-Control')).toBe(cache);
  expect(output.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect((await visit(`/data/releases/${current}/data/originals/source.pdf`)).status).toBe(404);
  expect((await visit(`/data/releases/${old}/data/core.json`)).status).toBe(404);
  expect((await visit(`/data/releases/${old}/manifest.json`)).status).toBe(200);
  expect((await visit(`/data/releases/${current}/data/missing.json`)).status).toBe(404);
});
