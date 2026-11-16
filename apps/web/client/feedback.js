// Shared form transport. Drafts stay in the form; receipts are never stored in the browser.
import { html } from './html.js';
import { serverScope } from './env.js';
export const MAX_TEXT = 1000;
export const TYPES = { error: 'Намерих грешка', unclear: 'Още не разбирам', idea: 'Предложи идея' };
export const siteKey = () =>
  serverScope()?.turnstileSiteKey ??
  (typeof document === 'undefined'
    ? ''
    : document.querySelector('meta[name="turnstile-site-key"]')?.content || '');
export const send = () => 'Изпрати';
export const sent = (id) => `Благодарим. Номер на сигнала: ${id}`;
export const controls = () =>
  html`<div data-feedback-widget></div><div hidden><label>Уебсайт<input name="website" tabindex="-1" autocomplete="off"></label></div><p data-feedback-status role="status">${siteKey() ? '' : 'Изпращането временно не е достъпно. Опитай след малко.'}</p>`;
let loading;
const formWidgets = new WeakMap();
function loadWidget() {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.onload = () => globalThis.turnstile.ready(() => resolve(globalThis.turnstile));
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error('widget unavailable'));
      };
      document.head.append(script);
    });
  return loading;
}
export function mountForms(root) {
  let disposed = false;
  const widgets = [];
  for (const container of root.querySelectorAll('[data-feedback-widget]')) {
    const form = container.closest('form');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    if (!siteKey()) continue;
    loadWidget()
      .then((api) => {
        if (disposed) return;
        const id = api.render(container, {
          sitekey: siteKey(),
          theme: 'light',
          callback: () => {
            button.disabled = false;
          },
          'expired-callback': () => {
            button.disabled = true;
          },
          'error-callback': () => {
            button.disabled = true;
            form.querySelector('[data-feedback-status]').textContent =
              'Проверката не успя. Опитай след малко.';
          },
        });
        widgets.push(id);
        formWidgets.set(form, id);
      })
      .catch(() => {
        if (!disposed)
          form.querySelector('[data-feedback-status]').textContent =
            'Изпращането временно не е достъпно. Опитай след малко.';
      });
  }
  return () => {
    disposed = true;
    for (const id of widgets) globalThis.turnstile?.remove(id);
  };
}
export async function submit(form, report) {
  const button = form.querySelector('[type="submit"]');
  const status = form.querySelector('[data-feedback-status]');
  if (!siteKey() || button.disabled) return null;
  button.disabled = true;
  status.textContent = 'Изпраща се…';
  try {
    const response = await fetch('/api/vrazka', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...report,
        url: location.pathname + location.search,
        website: form.elements.website.value,
        token: form.elements['cf-turnstile-response']?.value || '',
      }),
    });
    if (!response.ok) {
      status.textContent =
        response.status === 400 || response.status === 403
          ? 'Провери написаното и проверката за сигурност и опитай отново.'
          : 'Сигналът не е изпратен. Опитай след малко.';
      return null;
    }
    const { id } = await response.json();
    status.textContent = '';
    return id;
  } catch {
    status.textContent = 'Сигналът не е изпратен. Опитай след малко.';
    return null;
  } finally {
    globalThis.turnstile?.reset(formWidgets.get(form));
  }
}
