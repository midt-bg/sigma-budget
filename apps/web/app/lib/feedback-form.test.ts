// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  document.head.innerHTML = '<meta name="turnstile-site-key" content="test-site-key">';
  document.body.innerHTML =
    '<form><textarea name="text"></textarea><div data-feedback-widget></div><p data-feedback-status></p><button type="submit">Изпрати</button></form>';
});
afterEach(() => vi.unstubAllGlobals());
const form = () => document.querySelector('form')!;
const scripts = () => document.querySelectorAll('script[src*="challenges.cloudflare.com"]');
it('waits for interaction and renders only after the script loads', async () => {
  const { mountForms } = await import('../../client/feedback.js');
  const dispose = mountForms(document.body);
  expect(scripts()).toHaveLength(0);
  form().querySelector('textarea')!.focus();
  expect(scripts()).toHaveLength(1);
  const render = vi.fn(() => 'widget-id');
  const remove = vi.fn();
  vi.stubGlobal('turnstile', { render, remove });
  expect(render).not.toHaveBeenCalled();
  scripts()[0].dispatchEvent(new Event('load'));
  await Promise.resolve();
  expect(render).toHaveBeenCalledTimes(1);
  form().dispatchEvent(new Event('input', { bubbles: true }));
  expect(render).toHaveBeenCalledTimes(1);
  dispose();
  expect(remove).toHaveBeenCalledWith('widget-id');
});
it('starts verification on a submit without prior focus', async () => {
  const { mountForms } = await import('../../client/feedback.js');
  const dispose = mountForms(document.body);
  form().dispatchEvent(new Event('submit'));
  expect(scripts()).toHaveLength(1);
  dispose();
});
it('never loads a check without a site key, including on submit', async () => {
  document.querySelector('meta')!.setAttribute('content', '');
  const { mountForms } = await import('../../client/feedback.js');
  const dispose = mountForms(document.body);
  form().querySelector('textarea')!.focus();
  form().dispatchEvent(new Event('input'));
  form().dispatchEvent(new Event('submit'));
  expect(scripts()).toHaveLength(0);
  expect(form().querySelector('button')!.disabled).toBe(true);
  dispose();
});
it('does not render when navigation finishes before the script loads', async () => {
  const { mountForms } = await import('../../client/feedback.js');
  const dispose = mountForms(document.body);
  form().dispatchEvent(new Event('input'));
  dispose();
  const render = vi.fn();
  vi.stubGlobal('turnstile', { render });
  scripts()[0].dispatchEvent(new Event('load'));
  await Promise.resolve();
  expect(render).not.toHaveBeenCalled();
});

it('renders only the form being filled, leaving the other S27 tabs untouched', async () => {
  const first = form();
  const other = first.cloneNode(true) as HTMLFormElement;
  other.hidden = true;
  document.body.appendChild(other);
  document.body.appendChild(other.cloneNode(true));
  const { mountForms } = await import('../../client/feedback.js');
  const render = vi.fn((_container: Element) => 'widget');
  vi.stubGlobal('turnstile', { render, remove: vi.fn() });
  const dispose = mountForms(document.body);
  expect(render).not.toHaveBeenCalled();
  first.querySelector('textarea')!.focus();
  await Promise.resolve();
  expect(render).toHaveBeenCalledTimes(1);
  expect(render.mock.calls[0][0]).toBe(first.querySelector('[data-feedback-widget]'));
  dispose();
});
it('explains a submission before a token exists and sends nothing', async () => {
  const { submit } = await import('../../client/feedback.js');
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  expect(await submit(form(), { type: 'error', text: 'A valid report' })).toBeNull();
  expect(form().querySelector('[data-feedback-status]')!.textContent).toBe('Изчакай проверката.');
  expect(fetch).not.toHaveBeenCalled();
});
it('sends a short URL without duplicate block value while preserving the value itself', async () => {
  const { submit } = await import('../../client/feedback.js');
  const value = 'Кирилица '.repeat(12);
  const url = new URL('https://site.test/vrazka');
  url.searchParams.set('val', value);
  url.searchParams.set('from', 'vedomstva');
  vi.stubGlobal('location', url);
  form().insertAdjacentHTML(
    'beforeend',
    '<input name="website"><input name="cf-turnstile-response" value="test-token">',
  );
  const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
    Response.json({ id: 'receipt' }, { status: 201 }),
  );
  vi.stubGlobal('fetch', fetch);
  expect(await submit(form(), { type: 'error', text: 'A valid report', value })).toBe('receipt');
  const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
  expect(body).toMatchObject({ value, url: '/vrazka?from=vedomstva' });
});
it('caps the remaining path and query rather than rejecting a long page address', async () => {
  const { reportUrl } = await import('../../client/feedback.js');
  vi.stubGlobal('location', new URL('https://site.test/vrazka?from=' + 'x'.repeat(400)));
  expect(reportUrl()).toHaveLength(300);
  expect(reportUrl()).toMatch(/^\/vrazka\?from=x+$/);
});
