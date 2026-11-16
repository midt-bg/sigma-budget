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
