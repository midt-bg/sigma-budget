import { releaseData } from '../release-data';

const TEST_SECRET = '1x0000000000000000000000000000000AA';
const CONTEXT = ['route', 'block', 'value', 'source', 'url', 'term'] as const;
type Context = (typeof CONTEXT)[number];
export interface Report extends Partial<Record<Context, string>> {
  type: 'error' | 'unclear' | 'idea';
  text: string;
  contact?: string;
  website?: string;
  token?: string;
}
export function validateReport(input: unknown): Report | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const r = input as Record<string, unknown>;
  const allowed = [...CONTEXT, 'type', 'text', 'contact', 'website', 'token'];
  if (Object.keys(r).some((k) => !allowed.includes(k))) return null;
  if (typeof r.type !== 'string' || !['error', 'unclear', 'idea'].includes(r.type)) return null;
  if (typeof r.text !== 'string' || r.text.trim().length < 5 || r.text.length > 1000) return null;
  for (const k of CONTEXT) {
    if (
      r[k] !== undefined &&
      (typeof r[k] !== 'string' ||
        r[k].length > 300 ||
        /[\r\n\u0000-\u001f\u007f\u2028\u2029]/u.test(r[k]))
    )
      return null;
  }
  if (r.url) {
    const path = String(r.url);
    if (
      !path.startsWith('/') ||
      path.startsWith('//') ||
      path.includes('\\') ||
      path.includes('#') ||
      new URL(path, 'https://site.test').origin !== 'https://site.test'
    )
      return null;
  }
  if (
    r.contact !== undefined &&
    (typeof r.contact !== 'string' ||
      r.contact.length > 254 ||
      (r.contact !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.contact)))
  )
    return null;
  for (const k of ['website', 'token'])
    if (r[k] !== undefined && (typeof r[k] !== 'string' || r[k].length > 2048)) return null;
  return r as unknown as Report;
}

export function markdown(report: Report, id: string, received: string, release: string) {
  const fields = {
    id,
    received,
    type: report.type,
    route: report.route || '',
    block: report.block || '',
    value: report.value || '',
    source: report.source || '',
    url: report.url || '',
    term: report.term || '',
    release,
    contact: report.contact || '',
  };
  return (
    '---\nformat: 1\n' +
    Object.entries(fields)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n') +
    '\n---\n\n' +
    report.text
  );
}
const answer = (status: number, body: object = { error: 'report unavailable' }) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status === 405 ? { Allow: 'POST' } : {}),
      ...(status === 429 || status === 503 ? { 'Retry-After': '60' } : {}),
    },
  });

export async function vrazka(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return answer(405);
  if (
    request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    return answer(415);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return answer(403);
  if (Number(request.headers.get('Content-Length')) > 8192) return answer(413);
  let input: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return answer(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return answer(413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return answer(400);
  }
  const report = validateReport(input);
  if (!report) return answer(400);
  // Missing infrastructure never produces a receipt, including for the honeypot.
  if (!env.VRAZKA_BUCKET || !env.VRAZKA_IP_KEY || !env.TURNSTILE_SECRET_KEY || !env.VRAZKA_LIMITER)
    return answer(503);
  const id = crypto.randomUUID();
  if (report.website) return answer(201, { id });
  if (!report.token) return answer(400);
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown-client';
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: report.token,
        remoteip: ip,
      }),
    });
    if (!verification.ok) return answer(503);
    const result = await verification.json<{ success: boolean; hostname?: string }>();
    if (result.success !== true) return answer(403);
    if (
      env.TURNSTILE_SECRET_KEY !== TEST_SECRET &&
      result.hostname !== new URL(request.url).hostname
    )
      return answer(403);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.VRAZKA_IP_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip))),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    if (!(await env.VRAZKA_LIMITER.getByName('site').consume(hash))) return answer(429);
    const release = await releaseData(env, new URL(request.url).origin);
    if (!release.releaseId) return answer(503);
    const received = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const stamp = received.replace(/[-:]/g, '');
    await env.VRAZKA_BUCKET.put(
      `signali/${received.slice(0, 4)}/${received.slice(5, 7)}/${stamp}-${id}.md`,
      markdown(report, id, received, release.releaseId),
      {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
        customMetadata: { type: report.type, route: report.route || '' },
      },
    );
    return answer(201, { id });
  } catch {
    return answer(503);
  }
}
